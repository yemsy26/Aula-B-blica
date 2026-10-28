import { PersonalityConfig } from './types.js';
import { brainRegistry } from './brain/brainRegistry.js';
import { BrainChatMessage } from './brain/types.js';

export type RealBackendType =
  | 'DETERMINISTIC'
  | 'LOCAL_SERVER'
  | 'ON_DEVICE'
  | 'WEBGPU'
  | 'NATIVE_LLAMA_CPP';

export interface LocalServerConfig {
  endpoint: string;
  modelName: string;
  timeoutMs: number;
}

/**
 * Fachada de compatibilidad sobre BrainRegistry.
 *
 * Se conserva para no romper componentes existentes, pero toda la lógica
 * de red, streaming y salud vive en src/core/inference/brain/.
 */
export class RealModelBridge {
  private backendType: RealBackendType;
  private lastError: string | null = null;

  constructor() {
    const provider = brainRegistry.getConfig().provider;
    this.backendType =
      provider === 'deterministic'
        ? 'DETERMINISTIC'
        : provider === 'on-device'
          ? 'ON_DEVICE'
          : 'LOCAL_SERVER';
  }

  getBackendType(): RealBackendType {
    return this.backendType;
  }

  setBackendType(type: RealBackendType): void {
    this.backendType = type;

    if (type === 'DETERMINISTIC') {
      brainRegistry.configure({ provider: 'deterministic', endpoint: '' });
      return;
    }

    if (type === 'ON_DEVICE' || type === 'NATIVE_LLAMA_CPP') {
      const current = brainRegistry.getConfig();
      const installedModel =
        current.provider === 'on-device' ? current.model : current.model || 'ULTRALIGHT';
      brainRegistry.configure({
        provider: 'on-device',
        endpoint: '',
        model: /^[A-Z_0-9]+$/.test(installedModel) ? installedModel : 'ULTRALIGHT',
      });
      return;
    }

    if (type === 'LOCAL_SERVER') {
      const current = brainRegistry.getConfig();
      if (current.provider !== 'deterministic' && current.provider !== 'on-device') return;

      const endpoint = current.endpoint || 'http://localhost:11434';
      const provider = endpoint.includes('11434') ? 'ollama' : 'openai-compatible';
      brainRegistry.configure({ provider, endpoint });
      return;
    }

    // WebGPU todavía no tiene adaptador real. No fingimos que esté activo.
    this.lastError =
      'WebGPU aún no está implementado; usa el cerebro en el dispositivo (GGUF/WASM) o un servidor local.';
    brainRegistry.configure({ provider: 'deterministic', endpoint: '' });
  }

  getServerConfig(): LocalServerConfig {
    const config = brainRegistry.getConfig();
    return {
      endpoint: config.endpoint,
      modelName: config.model,
      timeoutMs: config.timeoutMs,
    };
  }

  setServerConfig(config: Partial<LocalServerConfig>): void {
    const patch: { endpoint?: string; model?: string; timeoutMs?: number } = {};
    if (config.endpoint !== undefined) patch.endpoint = config.endpoint;
    if (config.modelName !== undefined) patch.model = config.modelName;
    if (config.timeoutMs !== undefined) patch.timeoutMs = config.timeoutMs;

    const current = brainRegistry.getConfig();
    if (config.endpoint !== undefined && current.provider === 'deterministic') {
      patch.endpoint = config.endpoint;
    }

    brainRegistry.configure(patch);
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async pingLocalServer(): Promise<boolean> {
    const health = await brainRegistry.health();
    this.lastError = health.ok ? null : health.detail ?? 'Servidor local no disponible.';
    return health.ok;
  }

  async generateStream(
    prompt: string,
    personality: PersonalityConfig,
    groundTruthContext?: string,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (brainRegistry.getConfig().provider === 'deterministic') {
      throw new Error(
        'El puente a servidor local está desactivado. Configura Ollama o un endpoint OpenAI-compatible.'
      );
    }

    const messages: BrainChatMessage[] = [
      {
        role: 'system',
        content: [personality.systemPrompt, groundTruthContext || ''].filter(Boolean).join('\n\n'),
      },
      { role: 'user', content: prompt },
    ];

    const result = await brainRegistry.chat(
      {
        messages,
        temperature: personality.temperature,
        maxTokens: personality.maxOutputTokens,
        topP: personality.topP,
        stop: personality.stopSequences,
        stream: true,
      },
      onToken,
      signal
    );

    return result.text;
  }
}

export const realModelBridge = new RealModelBridge();
