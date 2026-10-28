import {
  BrainAdapter,
  BrainChatRequest,
  BrainChatResult,
  BrainConfig,
  BrainHealth,
  BrainProvider,
  BrainStatus,
} from './types.js';
import { DeterministicAdapter, DeterministicComposer } from './deterministicAdapter.js';
import { OllamaAdapter } from './ollamaAdapter.js';
import { OpenAICompatibleAdapter } from './openAiCompatAdapter.js';
import { OnDeviceAdapter } from './onDeviceAdapter.js';

const STORAGE_KEY = 'verbovivo_brain_config_v1';
const PROVIDERS: BrainProvider[] = [
  'deterministic',
  'on-device',
  'ollama',
  'openai-compatible',
];

export const DEFAULT_BRAIN_CONFIG: BrainConfig = {
  provider: 'deterministic',
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5:1.5b',
  timeoutMs: 45000,
  temperature: 0.45,
  maxTokens: 1600,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function sanitizeBrainConfig(raw: Partial<BrainConfig> | null | undefined): BrainConfig {
  const provider = PROVIDERS.includes(raw?.provider as BrainProvider)
    ? (raw?.provider as BrainProvider)
    : DEFAULT_BRAIN_CONFIG.provider;

  return {
    provider,
    endpoint: safeString(raw?.endpoint, DEFAULT_BRAIN_CONFIG.endpoint).trim(),
    model: safeString(raw?.model, DEFAULT_BRAIN_CONFIG.model).trim(),
    timeoutMs: clampNumber(raw?.timeoutMs, DEFAULT_BRAIN_CONFIG.timeoutMs, 1000, 300000),
    temperature: clampNumber(raw?.temperature, DEFAULT_BRAIN_CONFIG.temperature, 0, 2),
    maxTokens: Math.round(clampNumber(raw?.maxTokens, DEFAULT_BRAIN_CONFIG.maxTokens, 64, 32768)),
    updatedAt: safeString(raw?.updatedAt, new Date().toISOString()),
  };
}

function readStoredConfig(): BrainConfig {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_BRAIN_CONFIG };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BRAIN_CONFIG };
    return sanitizeBrainConfig(JSON.parse(raw) as Partial<BrainConfig>);
  } catch {
    return { ...DEFAULT_BRAIN_CONFIG };
  }
}

function persistConfig(config: BrainConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  } catch {
    // Entornos privados o sin almacenamiento: la configuración vive en memoria.
  }
}

/**
 * Registro de cerebros intercambiables.
 *
 * Regla de producto: el modelo nunca se elige por su nombre comercial.
 * Se elige por proveedor, salud, contexto e historial; el motor determinista
 * siempre queda como red de seguridad.
 */
export class BrainRegistry {
  private config: BrainConfig;
  private readonly deterministic: DeterministicAdapter;
  private readonly cache = new Map<string, BrainAdapter>();

  constructor(initial?: Partial<BrainConfig>, composer?: DeterministicComposer) {
    this.config = sanitizeBrainConfig({ ...readStoredConfig(), ...initial });
    this.deterministic = new DeterministicAdapter(composer);
  }

  getConfig(): BrainConfig {
    return { ...this.config };
  }

  setDeterministicComposer(composer: DeterministicComposer): void {
    this.deterministic.setComposer(composer);
  }

  configure(partial: Partial<BrainConfig>): BrainConfig {
    const next = sanitizeBrainConfig({
      ...this.config,
      ...partial,
      updatedAt: new Date().toISOString(),
    });

    // Si el usuario cambia de proveedor sin endpoint nuevo, proponemos el puerto habitual.
    if (partial.provider && partial.provider !== this.config.provider && !partial.endpoint) {
      if (partial.provider === 'ollama') next.endpoint = 'http://localhost:11434';
      if (partial.provider === 'openai-compatible') next.endpoint = 'http://localhost:1234/v1';
      if (partial.provider === 'deterministic' || partial.provider === 'on-device') {
        next.endpoint = '';
      }
    }

    if (partial.provider === 'on-device' && !partial.model) {
      next.model = next.model || 'ULTRALIGHT';
      if (/^(teologia-verificada|qwen2\.5|local-model)/i.test(next.model)) {
        next.model = 'ULTRALIGHT';
      }
    }

    this.releaseOnDeviceAdapters(
      next.provider === 'on-device' ? this.adapterKey(next) : undefined
    );
    this.config = next;
    persistConfig(next);
    return this.getConfig();
  }

  private adapterKey(config: BrainConfig): string {
    return `${config.provider}|${config.endpoint}|${config.model}|${config.timeoutMs}`;
  }

  /**
   * Un modelo GGUF cargado puede ocupar cientos de MB. Solo conservamos el
   * adaptador que coincide con la configuración activa; cualquier otro se libera.
   */
  private releaseOnDeviceAdapters(keepKey?: string): void {
    for (const [key, adapter] of this.cache) {
      if (!key.startsWith('on-device|') || key === keepKey) continue;
      this.cache.delete(key);
      if (adapter.release) void adapter.release();
    }
  }

  private adapterFor(config: BrainConfig): BrainAdapter {
    if (config.provider === 'deterministic') return this.deterministic;

    const key = this.adapterKey(config);
    const cached = this.cache.get(key);
    if (cached) return cached;

    let adapter: BrainAdapter;
    if (config.provider === 'on-device') {
      this.releaseOnDeviceAdapters(key);
      // Prefiere llama.cpp nativo en Android; en PC/web cae a wllama.
      adapter = new OnDeviceAdapter(config.model || 'ULTRALIGHT');
    } else if (config.provider === 'ollama') {
      adapter = new OllamaAdapter(config.endpoint, config.model, config.timeoutMs);
    } else {
      adapter = new OpenAICompatibleAdapter(config.endpoint, config.model, config.timeoutMs);
    }

    this.cache.set(key, adapter);
    return adapter;
  }

  getActiveAdapter(): BrainAdapter {
    return this.adapterFor(this.config);
  }

  getAdapter(provider: BrainProvider, config?: Partial<BrainConfig>): BrainAdapter {
    const merged = sanitizeBrainConfig({ ...this.config, ...config, provider });
    return this.adapterFor(merged);
  }

  async health(provider?: BrainProvider, config?: Partial<BrainConfig>, signal?: AbortSignal): Promise<BrainHealth> {
    const adapter = provider ? this.getAdapter(provider, config) : this.getActiveAdapter();
    return adapter.health(signal);
  }

  /**
   * Comprueba que el cerebro puede generar de verdad.
   * En on-device carga el GGUF y ejecuta el warmup del runtime.
   */
  async warmUp(
    provider?: BrainProvider,
    config?: Partial<BrainConfig>,
    signal?: AbortSignal
  ): Promise<BrainHealth> {
    const adapter = provider ? this.getAdapter(provider, config) : this.getActiveAdapter();
    if (!adapter.warmUp) return adapter.health(signal);
    return adapter.warmUp(signal);
  }

  async releaseActive(): Promise<void> {
    const adapter = this.getActiveAdapter();
    await adapter.release?.();
  }

  async chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult> {
    const adapter = this.getActiveAdapter();
    return adapter.chat(request, onToken, signal);
  }

  getStatus(): BrainStatus {
    const adapter = this.getActiveAdapter();
    return {
      config: this.getConfig(),
      label: adapter.label,
      provider: this.config.provider,
      model: this.config.model,
      isRealModel: this.config.provider !== 'deterministic',
    };
  }

  describeActive(): string {
    if (this.config.provider === 'deterministic') {
      return 'Motor determinista offline';
    }
    return this.getActiveAdapter().label;
  }

  /** Solo para pruebas: vuelve al estado por defecto sin borrar el compositor. */
  resetForTests(): void {
    this.config = { ...DEFAULT_BRAIN_CONFIG };
    this.cache.clear();
  }
}

export const brainRegistry = new BrainRegistry();
