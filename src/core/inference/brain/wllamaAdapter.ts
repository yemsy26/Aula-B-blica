import { DeviceSystemInfo } from '../../native-bridge/types.js';
import { AVAILABLE_MODELS } from '../modelRegistry.js';
import { ModelManifest, ModelProfileId } from '../types.js';
import {
  BrainAdapter,
  BrainCapabilities,
  BrainChatMessage,
  BrainChatRequest,
  BrainChatResult,
  BrainHealth,
} from './types.js';
import { linkAbort } from './streamParser.js';

/**
 * Adaptador GGUF en el dispositivo mediante wllama (llama.cpp compilado a WASM).
 *
 * Funciona en PC y en el WebView de Android porque usa el mismo WebAssembly.
 * No finge inferencia: si el archivo no está descargado, si el runtime no
 * carga o si el dispositivo se queda sin memoria, devuelve un error explícito.
 */

export interface OnDeviceWllama {
  loadModel(blobs: Blob[], params: Record<string, unknown>): Promise<void>;
  createChatCompletion(options: Record<string, unknown>): Promise<unknown>;
  exit(): Promise<void>;
}

export type WllamaConstructor = new (
  assets: { default: string },
  config?: {
    suppressNativeLog?: boolean;
    logger?: unknown;
    allowOffline?: boolean;
  }
) => OnDeviceWllama;

export interface WllamaRuntimeModule {
  Wllama: WllamaConstructor;
  LoggerWithoutDebug?: unknown;
}

export interface WllamaAdapterOptions {
  wasmUrl?: string;
  loadRuntime?: () => Promise<WllamaRuntimeModule>;
  readBlob?: (filePath: string) => Promise<Blob | null>;
  getFileSize?: (filePath: string) => Promise<number | null>;
  getDeviceInfo?: () => Promise<DeviceSystemInfo>;
  /** Límites del vigilante; las pruebas los reducen para no esperar minutos. */
  watchdog?: { firstTokenMs?: number; idleMs?: number };
}

/**
 * Límites del vigilante de inferencia.
 *
 * En Android el prefill legítimo de un 0.5B puede superar los dos minutos, así
 * que el umbral debe ser generoso. Pero un runtime bloqueado (worker muerto,
 * abortSignal ignorado) nunca devolvería el control: sin este límite la UI se
 * queda en «procesando contexto» para siempre. Son tiempos máximos de silencio,
 * no de duración total: cada token recibido reinicia el contador de inactividad.
 */
const WATCHDOG_LIMITS: Record<
  ModelProfileId,
  { desktop: [number, number]; android: [number, number] }
> = {
  ULTRALIGHT: { desktop: [180_000, 60_000], android: [360_000, 120_000] },
  STANDARD: { desktop: [300_000, 120_000], android: [720_000, 240_000] },
  ADVANCED_4B: { desktop: [480_000, 180_000], android: [1_200_000, 300_000] },
  MAX_8B: { desktop: [720_000, 240_000], android: [1_800_000, 360_000] },
  ULTRALIGHT_GPU: { desktop: [180_000, 60_000], android: [360_000, 120_000] },
};

export function resolveWatchdogLimits(
  platform: DeviceSystemInfo['platform'],
  modelId: ModelProfileId
): { firstTokenMs: number; idleMs: number } {
  const limits = WATCHDOG_LIMITS[modelId] ?? WATCHDOG_LIMITS.ULTRALIGHT;
  const [firstTokenMs, idleMs] = platform === 'android' ? limits.android : limits.desktop;
  return { firstTokenMs, idleMs };
}

const DEFAULT_CAPABILITIES: BrainCapabilities = {
  contextWindow: 4096,
  streaming: true,
  chat: true,
  jsonMode: false,
  languages: ['es', 'en'],
  local: true,
};

/**
 * Límites de salida por tamaño de modelo.
 *
 * En un teléfono, generar cientos de tokens con WASM de un solo hilo tarda
 * minutos. Preferimos una respuesta corta y completa a un texto que el usuario
 * cancelará antes de leer. Los documentos extensos se resuelven con el
 * compositor verificado o con Ollama/LM Studio en PC.
 */
export const OUTPUT_CAP_BY_MODEL: Record<ModelProfileId, number> = {
  ULTRALIGHT: 256,
  STANDARD: 640,
  ADVANCED_4B: 1024,
  MAX_8B: 1536,
  ULTRALIGHT_GPU: 256,
};

/** Contexto efectivo: suficiente para conversar sin disparar el uso de RAM. */
export const CONTEXT_BY_MODEL: Record<ModelProfileId, number> = {
  ULTRALIGHT: 2048,
  STANDARD: 4096,
  ADVANCED_4B: 4096,
  MAX_8B: 8192,
  ULTRALIGHT_GPU: 2048,
};

function defaultWasmUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}wllama/wllama.wasm`;
}

/**
 * Import diferido del puente para evitar un ciclo de módulos:
 * nativeBridge -> localEngine -> brainRegistry -> wllamaAdapter -> nativeBridge.
 */
async function getLocalBridge() {
  const { nativeBridge } = await import('../../native-bridge/bridge.js');
  return nativeBridge;
}

export function resolveOnDeviceManifest(modelId: string): ModelManifest {
  const normalized = modelId.trim().toUpperCase();
  if (normalized in AVAILABLE_MODELS) {
    return AVAILABLE_MODELS[normalized as ModelProfileId];
  }

  return (
    Object.values(AVAILABLE_MODELS).find(
      (manifest) => manifest.archivoDestino.toLowerCase() === modelId.trim().toLowerCase()
    ) ?? AVAILABLE_MODELS.ULTRALIGHT
  );
}

export function describeOnDeviceModel(modelId: string): string {
  const manifest = resolveOnDeviceManifest(modelId);
  return `En el dispositivo · ${manifest.tamanoParametros} ${manifest.cuantizacion}`;
}

/** Estimación conservadora: el español ronda 3–4 caracteres por token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2) + 4;
}

function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.6);
  const tail = Math.floor(maxChars * 0.3);
  return `${text.slice(0, head).trimEnd()}\n[…]\n${text.slice(-tail).trimStart()}`;
}

/**
 * Ajusta el prompt al contexto real del modelo pequeño.
 *
 * Los modelos de 0.5B–1.5B no pueden recibir el contrato completo más 16
 * mensajes de historial. Conservamos el sistema, el turno actual y los
 * mensajes recientes; el resto se recorta de forma explícita.
 */
export function fitMessagesForContext(
  messages: BrainChatMessage[],
  nCtx: number,
  reservedOutput: number,
  ultraCompact = false
): BrainChatMessage[] {
  const budget = Math.max(384, nCtx - reservedOutput - 64);
  const smallContext = nCtx <= 2048;
  // En 2048 tokens priorizamos el turno actual: dos mensajes de historial ya
  // cuestan más prefill del que un 0.5B puede permitirse en un teléfono.
  // En Android el coste se multiplica (WASM de un solo hilo): el prompt se
  // queda con el sistema esencial y la pregunta actual, sin historial.
  const maxMessages = ultraCompact ? 1 : smallContext ? 2 : nCtx >= 8192 ? 12 : 8;
  const assistantChars = ultraCompact ? 180 : smallContext ? 260 : 900;
  const userChars = ultraCompact ? 200 : smallContext ? 240 : 700;

  const systemParts = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean);
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      ...message,
      content: truncateMiddle(
        message.content.trim(),
        message.role === 'assistant' ? assistantChars : userChars
      ),
    }));

  let system = systemParts.join('\n\n');
  const systemBudgetTokens = Math.min(
    Math.floor(budget * 0.68),
    ultraCompact ? 420 : smallContext ? 700 : nCtx >= 8192 ? 3000 : 1400
  );
  const systemBudgetChars = systemBudgetTokens * 3.2;

  if (estimateTokens(system) > systemBudgetTokens) {
    system = truncateMiddle(system, Math.floor(systemBudgetChars));
  }

  const selected: BrainChatMessage[] = [];
  let used = estimateTokens(system);
  const recent = conversation.slice(-maxMessages);

  for (let index = recent.length - 1; index >= 0; index--) {
    const message = recent[index];
    const cost = estimateTokens(message.content);

    if (used + cost <= budget || selected.length === 0) {
      selected.unshift(message);
      used += cost;
    } else if (message.role === 'user') {
      // El turno actual nunca se descarta: se recorta hasta caber.
      const available = Math.max(120, Math.floor((budget - used) * 3.2));
      const shortened = truncateMiddle(message.content, available);
      selected.unshift({ ...message, content: shortened });
      used += estimateTokens(shortened);
      break;
    } else {
      break;
    }
  }

  return system ? [{ role: 'system', content: system }, ...selected] : selected;
}

/**
 * Un modelo de bolsillo a veces continúa el contrato del sistema y lo pega en
 * la respuesta («Responde en español claro…», «TAREA: …»). Eso no es contenido
 * teológico: se recorta antes de mostrarlo. Solo se eliminan líneas exactas
 * del contrato, no frases del usuario.
 */
export function sanitizeModelOutput(text: string): string {
  const leakPatterns = [
    /^\s*Responde en español claro[^\n]*$/gim,
    /^\s*No repitas frases ni palabras\.?\s*$/gim,
    /^\s*Cita con \[CITA:[^\n]*$/gim,
    /^\s*No inventes citas[^\n]*$/gim,
    /^\s*Tradición:[^\n]*Nivel:[^\n]*$/gim,
    /^\s*ESTADO:[^\n]*$/gim,
    /^\s*TAREA:[^\n]*$/gim,
  ];

  let cleaned = text;
  for (const pattern of leakPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Si el texto útil termina y luego empieza la instrucción en la misma línea,
  // cortamos desde ahí para no arrastrar media frase del contrato.
  const inlineLeak = cleaned.search(/Responde en español claro,? en 1[–-]3 frases/i);
  if (inlineLeak > 0) {
    cleaned = cleaned.slice(0, inlineLeak);
  }

  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

function extractChunkText(chunk: unknown): string {
  if (!chunk || typeof chunk !== 'object') return '';
  const choices = (chunk as {
    choices?: Array<{ delta?: { content?: string | null } }>;
  }).choices;
  const content = choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

function extractFinishReason(chunk: unknown): 'stop' | 'length' | null {
  if (!chunk || typeof chunk !== 'object') return null;
  const choices = (chunk as {
    choices?: Array<{ finish_reason?: 'stop' | 'length' | string | null }>;
  }).choices;
  const reason = choices?.[0]?.finish_reason;
  return reason === 'stop' || reason === 'length' ? reason : null;
}

function extractUsage(chunk: unknown): { promptTokens?: number; completionTokens?: number } | undefined {
  if (!chunk || typeof chunk !== 'object') return undefined;
  const usage = (chunk as {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    } | null;
  }).usage;

  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
  };
}

interface WllamaTimings {
  promptPerSecond?: number;
  predictedPerSecond?: number;
  promptTokens?: number;
  predictedTokens?: number;
  cacheTokens?: number;
}

/**
 * wllama publica tiempos reales de llama.cpp cuando se pide
 * `timings_per_token`. Son la única forma honesta de saber cuánto cuesta
 * el prefill y cuánto la generación en el dispositivo del usuario.
 */
function extractTimings(chunk: unknown): WllamaTimings | undefined {
  if (!chunk || typeof chunk !== 'object') return undefined;
  const timings = (chunk as {
    timings?: {
      cache_n?: number;
      prompt_n?: number;
      prompt_per_second?: number;
      predicted_n?: number;
      predicted_per_second?: number;
    };
  }).timings;

  if (!timings) return undefined;
  return {
    cacheTokens: timings.cache_n,
    promptTokens: timings.prompt_n,
    promptPerSecond: timings.prompt_per_second,
    predictedTokens: timings.predicted_n,
    predictedPerSecond: timings.predicted_per_second,
  };
}

export class WllamaAdapter implements BrainAdapter {
  readonly id: string;
  readonly kind = 'on-device' as const;
  readonly capabilities: BrainCapabilities;

  private readonly manifest: ModelManifest;
  private readonly options: WllamaAdapterOptions;
  private instance: OnDeviceWllama | null = null;
  private loadPromise: Promise<OnDeviceWllama> | null = null;
  private resolvedContext = 0;
  private resolvedThreads = 1;
  private devicePlatform: DeviceSystemInfo['platform'] = 'web';
  private modelReady = false;

  constructor(modelId: string, options: WllamaAdapterOptions = {}) {
    this.manifest = resolveOnDeviceManifest(modelId);
    this.options = options;
    this.id = `on-device:${this.manifest.id}`;
    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      contextWindow: CONTEXT_BY_MODEL[this.manifest.id],
      maxOutputTokens: OUTPUT_CAP_BY_MODEL[this.manifest.id],
    };
  }

  get label(): string {
    return describeOnDeviceModel(this.manifest.id);
  }

  private async getRuntime(): Promise<WllamaRuntimeModule> {
    if (this.options.loadRuntime) return this.options.loadRuntime();

    // Import dinámico: el runtime de 8.4 MB solo se carga cuando el usuario
    // activa este cerebro, no al abrir la aplicación.
    const module = (await import(
      '@wllama/wllama/esm/index.js'
    )) as unknown as WllamaRuntimeModule;

    if (!module?.Wllama) {
      throw new Error('El runtime GGUF/WASM no exporta la clase Wllama.');
    }

    return module;
  }

  private async getFileSize(): Promise<number | null> {
    if (this.options.getFileSize) return this.options.getFileSize(this.manifest.archivoDestino);
    const bridge = await getLocalBridge();
    return bridge.getPrivateFileSize(this.manifest.archivoDestino);
  }

  private async readModelBlob(): Promise<Blob | null> {
    if (this.options.readBlob) return this.options.readBlob(this.manifest.archivoDestino);
    const bridge = await getLocalBridge();
    return bridge.readPrivateBlob(this.manifest.archivoDestino);
  }

  private async getDeviceInfo(): Promise<DeviceSystemInfo> {
    if (this.options.getDeviceInfo) return this.options.getDeviceInfo();
    const bridge = await getLocalBridge();
    return bridge.getSystemInfo();
  }

  private resolveThreads(info: DeviceSystemInfo): number {
    // SharedArrayBuffer solo existe en un contexto aislado (COOP/COEP).
    // wllama cambia solo entre el binario de un hilo y el multihilo según
    // ese soporte; aquí solo decidimos cuántos hilos pedirle.
    const isolated =
      typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const hasSharedMemory = typeof SharedArrayBuffer !== 'undefined';

    if (!isolated || !hasSharedMemory) return 1;

    const cores =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    // Un núcleo queda para la interfaz, el WebView y la síntesis de voz.
    const usable = Math.max(1, cores - 1);
    return info.platform === 'android' ? Math.min(4, usable) : Math.min(8, usable);
  }

  private resolveContext(): number {
    return CONTEXT_BY_MODEL[this.manifest.id];
  }

  async health(signal?: AbortSignal): Promise<BrainHealth> {
    const started = Date.now();

    if (signal?.aborted) {
      return { ok: false, detail: 'Comprobación cancelada.' };
    }

    try {
      const size = await this.getFileSize();
      if (size === null || size === 0) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          modelAvailable: false,
          detail: `El archivo ${this.manifest.archivoDestino} no está descargado. Descárgalo abajo y vuelve a comprobar.`,
        };
      }

      const info = await this.getDeviceInfo();
      const sizeMb = Math.round(size / (1024 * 1024));
      const ramWarning =
        info.estimatedRamMb < this.manifest.ramMinimaRequeridaMb
          ? ` Tu dispositivo reporta ${(info.estimatedRamMb / 1024).toFixed(1)} GB y el archivo declara ${(this.manifest.ramMinimaRequeridaMb / 1024).toFixed(0)} GB mínimos; la carga podría fallar.`
          : '';
      // Honestidad de rendimiento: el WebView de Android no permite
      // SharedArrayBuffer, así que llama.cpp corre en un solo hilo. Prometer
      // fluidez aquí solo genera abandono a mitad de la primera respuesta.
      const mobileNote =
        info.platform === 'android'
          ? ' En Android el WebView ejecuta el modelo en un solo hilo: una respuesta breve puede tardar uno o varios minutos. Para estudio extenso o respuestas rápidas, conecta Ollama en tu PC por Wi-Fi.'
          : '';

      return {
        ok: true,
        latencyMs: Date.now() - started,
        modelAvailable: true,
        models: [this.manifest.archivoDestino],
        detail: `Archivo presente (${sizeMb} MB). Pulsa «Cargar y probar» para verificar que este dispositivo puede ejecutarlo.${ramWarning}${mobileNote}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : 'No se pudo comprobar el archivo local.',
      };
    }
  }

  async warmUp(signal?: AbortSignal): Promise<BrainHealth> {
    const started = Date.now();

    try {
      await this.ensureLoaded(signal);
      return {
        ok: true,
        latencyMs: Date.now() - started,
        modelAvailable: true,
        models: [this.manifest.archivoDestino],
        detail: `Modelo cargado y listo en ${((Date.now() - started) / 1000).toFixed(1)} s. Contexto ${this.resolvedContext} tokens, ${this.resolvedThreads} hilo(s).`,
      };
    } catch (error) {
      if (signal?.aborted) {
        return { ok: false, latencyMs: Date.now() - started, detail: 'Carga cancelada.' };
      }
      return {
        ok: false,
        latencyMs: Date.now() - started,
        modelAvailable: (await this.getFileSize().catch(() => null)) !== null,
        detail:
          error instanceof Error
            ? `La carga falló: ${error.message}`
            : 'La carga del modelo falló por un error desconocido.',
      };
    }
  }

  private async ensureLoaded(signal?: AbortSignal): Promise<OnDeviceWllama> {
    if (this.instance && this.modelReady) return this.instance;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadInternal(signal).catch((error) => {
      this.loadPromise = null;
      throw error;
    });

    return this.loadPromise;
  }

  private async loadInternal(signal?: AbortSignal): Promise<OnDeviceWllama> {
    const size = await this.getFileSize();
    if (size === null || size === 0) {
      throw new Error(
        `El archivo ${this.manifest.archivoDestino} no está descargado en este dispositivo.`
      );
    }

    if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');

    const info = await this.getDeviceInfo();
    const context = this.resolveContext();
    const threads = this.resolveThreads(info);
    const blob = await this.readModelBlob();

    if (!blob) {
      throw new Error(
        `No se pudo leer ${this.manifest.archivoDestino} del almacenamiento privado.`
      );
    }

    if (import.meta.env.DEV) {
      console.info(
        `[Wllama] cargando ${this.manifest.archivoDestino} · contexto ${context} · ${threads} hilo(s) · aislado ${typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated}`
      );
    }

    const runtime = await this.getRuntime();
    const wllama = new runtime.Wllama(
      { default: this.options.wasmUrl ?? defaultWasmUrl() },
      {
        suppressNativeLog: true,
        logger: runtime.LoggerWithoutDebug,
        allowOffline: true,
      }
    );

    try {
      await wllama.loadModel([blob], {
        n_ctx: context,
        n_threads: threads,
        n_gpu_layers: 0,
        warmup: true,
      });
    } catch (error) {
      try {
        await wllama.exit();
      } catch {
        // El runtime pudo no haber inicializado por completo.
      }

      throw new Error(
        error instanceof Error
          ? `No se pudo cargar el GGUF (${error.message}). Verifica que el archivo esté completo y que haya RAM suficiente.`
          : 'No se pudo cargar el GGUF en este dispositivo.'
      );
    }

    this.instance = wllama;
    this.resolvedContext = context;
    this.resolvedThreads = threads;
    this.devicePlatform = info.platform;
    this.modelReady = true;

    return wllama;
  }

  async chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult> {
    const started = Date.now();
    const linked = linkAbort(signal, 0);

    // La cancelación del usuario y el vigilante comparten un solo AbortController
    // para detener llama.cpp, pero se distinguen al informar el error.
    const inference = new AbortController();
    const onLinkedAbort = () => inference.abort();
    if (linked.signal.aborted) inference.abort();
    else linked.signal.addEventListener('abort', onLinkedAbort, { once: true });

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogStage: 'first-token' | 'idle' = 'first-token';
    let watchdogLimitMs = 0;
    let watchdogFired = false;

    const disarmWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const armWatchdog = (stage: 'first-token' | 'idle', limitMs: number) => {
      disarmWatchdog();
      watchdogStage = stage;
      watchdogLimitMs = limitMs;
      watchdogTimer = setTimeout(() => {
        watchdogFired = true;
        inference.abort();
      }, limitMs);
    };

    const watchdogError = () => {
      const seconds = Math.max(1, Math.round(watchdogLimitMs / 1000));
      return new Error(
        watchdogStage === 'first-token'
          ? `El modelo local no emitió el primer token en ${seconds} s y se detuvo la inferencia. ` +
              'El archivo puede estar completo, pero el runtime no respondió: reintenta o usa un modelo menor.'
          : `El modelo local dejó de emitir tokens durante ${seconds} s y se detuvo la inferencia. ` +
              'Puedes reintentar la petición o usar un modelo menor.'
      );
    };

    if (!this.modelReady) request.onActivity?.('loading');

    try {
      const wllama = await this.ensureLoaded(linked.signal);

      if (linked.signal.aborted) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }

      // El modelo ya está en memoria, pero aún falta procesar el prompt
      // (prefill). En Android de un solo hilo eso puede durar minutos: la UI
      // debe decir «procesando», no «generando», hasta que llegue el primer
      // token. Si el runtime no emite tokens, el vigilante corta la espera.
      request.onActivity?.('prefill');

      const defaultLimits = resolveWatchdogLimits(this.devicePlatform, this.manifest.id);
      const watchdogLimits = {
        firstTokenMs: this.options.watchdog?.firstTokenMs ?? defaultLimits.firstTokenMs,
        idleMs: this.options.watchdog?.idleMs ?? defaultLimits.idleMs,
      };
      armWatchdog('first-token', watchdogLimits.firstTokenMs);

      // En un teléfono el mismo modelo va a un hilo y cada token cuesta
      // varios segundos. Recortamos la salida para que una respuesta completa
      // llegue antes de que el usuario abandone la pantalla.
      const isAndroidPocket =
        this.devicePlatform === 'android' && this.manifest.id === 'ULTRALIGHT';
      const platformCap = isAndroidPocket
        ? 128
        : OUTPUT_CAP_BY_MODEL[this.manifest.id];
      const maxOutput = Math.min(
        Math.max(32, request.maxTokens || 0),
        platformCap,
        Math.max(64, Math.floor(this.resolvedContext * 0.3))
      );
      const messages = fitMessagesForContext(
        request.messages,
        this.resolvedContext,
        maxOutput,
        isAndroidPocket
      );

      // Diagnóstico de desarrollo: sin esto es imposible distinguir un prompt
      // enorme de una CPU lenta. En producción no se imprime nada.
      if (import.meta.env.DEV) {
        const promptText = messages.map((message) => message.content).join('\n');
        console.info(
          `[Wllama] prompt ≈ ${estimateTokens(promptText)} tokens (${promptText.length} caracteres), salida máx. ${maxOutput}`
        );
      }

      let fullText = '';
      let firstTokenMs: number | undefined;
      const streamState: {
        finishReason: 'stop' | 'length' | 'unknown';
        usage?: { promptTokens?: number; completionTokens?: number };
        timings?: WllamaTimings;
      } = { finishReason: 'unknown' };

      // Un 0.5B con temperatura baja y sin penalizaciones entra en bucles
      // («la paz es el amor, y no el mal» repetido). Estos valores siguen la
      // recomendación de Qwen2.5 para modelos pequeños y cortan la repetición
      // sin volver la respuesta impredecible.
      const isPocketModel =
        this.manifest.id === 'ULTRALIGHT' || this.manifest.id === 'STANDARD';

      await wllama.createChatCompletion({
        messages,
        stream: true,
        temperature: Math.max(request.temperature, isPocketModel ? 0.65 : 0.5),
        max_tokens: maxOutput,
        top_p: 0.85,
        top_k: 40,
        min_p: 0.05,
        penalty_repeat: 1.12,
        penalty_freq: 0.15,
        penalty_present: 0.2,
        penalty_last_n: 64,
        abortSignal: inference.signal,
        // Reutiliza el KV cache del prefijo común entre turnos. Sin esto,
        // cada mensaje vuelve a procesar el contrato completo desde cero.
        cache_prompt: true,
        timings_per_token: true,
        onData: (chunk: unknown) => {
          const token = extractChunkText(chunk);
          if (token) {
            if (firstTokenMs === undefined) {
              firstTokenMs = Date.now() - started;
              request.onActivity?.('generating');
            }
            // Mientras llegan tokens el runtime está vivo: el vigilante solo
            // debe cortar silencios anómalos, no respuestas lentas pero reales.
            armWatchdog('idle', watchdogLimits.idleMs);
            fullText += token;
            onToken?.(token);
          }

          const reason = extractFinishReason(chunk);
          if (reason) streamState.finishReason = reason;

          const chunkUsage = extractUsage(chunk);
          if (chunkUsage) streamState.usage = chunkUsage;

          const timings = extractTimings(chunk);
          if (timings) streamState.timings = timings;
        },
      });

      disarmWatchdog();

      if (watchdogFired) throw watchdogError();

      if (linked.signal.aborted) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }

      const text = sanitizeModelOutput(fullText);
      if (text.length === 0) {
        throw new Error('El modelo local devolvió una respuesta vacía.');
      }

      const finalText =
        streamState.finishReason === 'length'
          ? `${text}\n\n> **Nota del cerebro local:** se alcanzó el límite de ${maxOutput} tokens de este dispositivo. Puedes pedir «continúa» o usar un modelo mayor.`
          : text;

      if (import.meta.env.DEV) {
        const timings = streamState.timings;
        const speed = timings
          ? ` · prefill ${timings.promptPerSecond?.toFixed(1) ?? '?'} tok/s (${timings.promptTokens ?? '?'} nuevos, ${timings.cacheTokens ?? 0} en caché) · generación ${timings.predictedPerSecond?.toFixed(2) ?? '?'} tok/s (${timings.predictedTokens ?? '?'} tokens)`
          : '';
        console.info(
          `[Wllama] primer token en ${firstTokenMs ?? '?'} ms, respuesta en ${Date.now() - started} ms (${fullText.trim().split(/\s+/).length} palabras)${speed}`
        );
      }

      return {
        text: finalText,
        brainId: this.id,
        provider: 'on-device',
        model: this.manifest.archivoDestino,
        finishReason: streamState.finishReason === 'unknown' ? 'stop' : streamState.finishReason,
        usage: streamState.usage,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      disarmWatchdog();

      if (watchdogFired && !signal?.aborted) {
        throw watchdogError();
      }

      if (signal?.aborted || linked.signal.aborted) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }

      if (
        error instanceof Error &&
        (error.name === 'AbortError' || /abort/i.test(error.message))
      ) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }

      throw error;
    } finally {
      disarmWatchdog();
      linked.signal.removeEventListener('abort', onLinkedAbort);
      request.onActivity?.('done');
      linked.cleanup();
    }
  }

  async release(): Promise<void> {
    const instance = this.instance;
    this.instance = null;
    this.loadPromise = null;
    this.modelReady = false;
    this.resolvedContext = 0;

    if (!instance) return;

    try {
      await instance.exit();
    } catch {
      // Liberar memoria es best-effort; el WebView también puede reciclar el worker.
    }
  }
}
