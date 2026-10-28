import { ModelManifest } from '../types.js';
import {
  NativeAcceleration,
  NativeAccelerationPolicy,
  getNativeLlamaInfo,
  listNativeModels,
  loadNativeModel,
  generateNative,
  releaseNativeModel,
  resetNativeLlamaInfoCache,
} from '../../native-bridge/llamaNative.js';
import {
  BrainAdapter,
  BrainCapabilities,
  BrainChatMessage,
  BrainChatRequest,
  BrainChatResult,
  BrainHealth,
} from './types.js';
import {
  CONTEXT_BY_MODEL,
  describeOnDeviceModel,
  fitMessagesForContext,
  resolveOnDeviceManifest,
  sanitizeModelOutput,
} from './wllamaAdapter.js';
import { effortForModel } from './effortContract.js';

/**
 * Adaptador del cerebro GGUF con llama.cpp nativo (JNI + NDK).
 *
 * Solo se usa en Android cuando el APK incluye la biblioteca. A diferencia de
 * wllama/WASM, el prompt se procesa en varios hilos reales y el modelo vive en
 * memoria nativa, fuera del heap del WebView. Si el motor no está disponible,
 * el adaptador híbrido cae a WASM sin mentir al usuario.
 */

const DEFAULT_CAPABILITIES: BrainCapabilities = {
  contextWindow: 4096,
  streaming: true,
  chat: true,
  jsonMode: false,
  languages: ['es', 'en'],
  local: true,
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2) + 4;
}

/**
 * Presupuesto de salida por perfil en el motor nativo.
 *
 * Es más alto que el de wllama/WASM porque aquí el prompt se procesa en varios
 * hilos reales y el modelo vive fuera del WebView. Aun así no se sube sin
 * límite: el contexto se comparte con el prompt y cada token cuesta tiempo en
 * el teléfono. La continuación automática cubre el resto del presupuesto.
 */
const NATIVE_OUTPUT_CAP_BY_MODEL: Record<string, number> = {
  ULTRALIGHT: 512,
  STANDARD: 1024,
  ADVANCED_4B: 1200,
  MAX_8B: 1800,
  ULTRALIGHT_GPU: 512,
};

/**
 * El plan de esfuerzo (effortContract) manda sobre este techo histórico: fija
 * el total del turno, el primer bloque y cuántas continuaciones se permiten.
 * El techo por perfil queda como última red de seguridad.
 */

const CONTINUE_INSTRUCTION =
  'Continúa exactamente donde se cortó la respuesta anterior. No repitas lo ya escrito, no saludes y no añadas introducción: escribe solo la continuación.';

/**
 * El plugin rechaza con el código ACCELERATION_FAILED cuando Vulkan/Hexagon
 * falla durante el cálculo. Es recuperable: el plugin ya liberó la sesión y
 * puso el acelerador en cuarentena, así que se puede recargar en CPU y repetir
 * el mismo bloque sin que el usuario reenvíe nada.
 */
function isAccelerationFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code === 'string' && candidate.code === 'ACCELERATION_FAILED') {
    return true;
  }
  return (
    typeof candidate.message === 'string' &&
    candidate.message.includes('ACCELERATION_FAILED')
  );
}


function joinText(existing: string, next: string): string {  const last = existing[existing.length - 1] ?? '';
  const first = next[0] ?? '';
  if (!last || !first) return existing + next;
  if (/\s/.test(last)) return existing + next;
  if (/^[.,;:!?)\]}%]/.test(first)) return existing + next;
  if (/[¿¡(\[{"']/.test(last)) return existing + next;
  return `${existing} ${next}`;
}

/**
 * Une una continuación sin repetir el final del bloque anterior. Los modelos
 * pequeños suelen reanudar copiando la última frase; sin esta poda el texto
 * final quedaría duplicado aunque el streaming se vea continuo.
 */
function joinContinuation(existing: string, next: string): string {
  const cleaned = next.trim();
  if (!cleaned) return existing;
  if (!existing) return cleaned;

  const tail = existing.slice(-240);
  const head = cleaned.slice(0, 240);
  const maxOverlap = Math.min(tail.length, head.length);
  for (let length = maxOverlap; length >= 24; length -= 1) {
    if (tail.endsWith(head.slice(0, length))) {
      const rest = cleaned.slice(length).trimStart();
      if (!rest) return existing;
      return joinText(existing, rest);
    }
  }
  return joinText(existing, cleaned);
}

/**
 * Prepara el prompt de continuación: sistema y turno actual recortados, la
 * cola de lo ya generado y una instrucción explícita. La cola se dimensiona
 * con el contexto libre para no provocar un desbordamiento en llama.cpp.
 */
function buildContinuationMessages(
  original: BrainChatMessage[],
  accumulated: string,
  context: number,
  outputBudget: number
): BrainChatMessage[] {
  const instructionTokens = estimateTokens(CONTINUE_INSTRUCTION);
  const tailChars = Math.max(
    400,
    Math.min(2400, Math.floor((context - outputBudget - instructionTokens - 448) * 2.2))
  );
  const tail = accumulated.slice(-tailChars);
  const tailTokens = estimateTokens(tail);
  const reserved = outputBudget + tailTokens + instructionTokens + 64;
  const base = fitMessagesForContext(
    original,
    context,
    Math.min(reserved, Math.max(512, context - 384)),
    false
  );

  return [
    ...base,
    { role: 'assistant', content: tail },
    { role: 'user', content: CONTINUE_INSTRUCTION },
  ];
}

export class NativeLlamaAdapter implements BrainAdapter {
  readonly id: string;
  readonly kind = 'on-device' as const;
  readonly capabilities: BrainCapabilities;

  private readonly manifest: ModelManifest;
  private modelReady = false;
  private loadPromise: Promise<void> | null = null;
  private resolvedContext = 0;
  private resolvedThreads = 0;
  private resolvedAbi = '';
  private resolvedAcceleration: NativeAcceleration = 'cpu';
  private resolvedNpuName = '';
  private resolvedNpuArch = 0;
  private resolvedNpuFallback = false;
  private resolvedNpuError = '';
  private resolvedGpuName = '';
  private resolvedGpuLayers = 0;
  private resolvedGpuFallback = false;
  private resolvedGpuError = '';
  private resolvedPolicy: NativeAccelerationPolicy | null = null;

  constructor(modelId: string) {
    this.manifest = resolveOnDeviceManifest(modelId);
    this.id = `on-device:${this.manifest.id}`;
    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      contextWindow: CONTEXT_BY_MODEL[this.manifest.id],
      maxOutputTokens: NATIVE_OUTPUT_CAP_BY_MODEL[this.manifest.id] ?? 1024,
    };
  }

  get label(): string {
    return `${describeOnDeviceModel(this.manifest.id)} · motor nativo`;
  }

  async health(signal?: AbortSignal): Promise<BrainHealth> {
    const started = Date.now();

    if (signal?.aborted) {
      return { ok: false, detail: 'Comprobación cancelada.' };
    }

    const info = await getNativeLlamaInfo();
    if (!info?.available) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        modelAvailable: false,
        detail:
          'Este APK no incluye llama.cpp nativo para el ABI del dispositivo. Se usará wllama/WASM como respaldo.',
      };
    }

    const files = await listNativeModels();
    const file = files.find((item) => item.fileName === this.manifest.archivoDestino);
    if (!file) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        modelAvailable: false,
        detail: `El archivo ${this.manifest.archivoDestino} no está descargado en el almacenamiento nativo. Descárgalo de nuevo desde el gestor de modelos.`,
      };
    }

    const sizeMb = Math.round(file.sizeBytes / (1024 * 1024));
    const ramWarning =
      info.totalRamMb > 0 && info.totalRamMb < this.manifest.ramMinimaRequeridaMb
        ? ` El teléfono reporta ${(info.totalRamMb / 1024).toFixed(1)} GB y el perfil declara ${(this.manifest.ramMinimaRequeridaMb / 1024).toFixed(0)} GB mínimos; la carga podría fallar.`
        : '';
    const policy = info.accelerationPolicy;
    const npuUsable = info.npu?.usable === true && policy?.npu?.usable !== false;
    const gpuUsable = info.gpu?.usable === true && policy?.gpu?.usable !== false;
    const gpuProfileReady =
      this.manifest.id === 'ULTRALIGHT_GPU' &&
      info.gpu?.usable === true &&
      policy?.gpu?.quarantined !== true;
    const accelerationNote = gpuProfileReady
      ? ` Perfil GPU verificado: se cargará con Vulkan (${info.gpu?.name || 'Adreno 750'}) aunque la política general omita Vulkan en Adreno; si el driver falla, se reintenta en CPU.`
      : npuUsable
      ? ` NPU Hexagon v${info.npu?.arch || '?'} (${info.npu?.name || 'HTP'}) utilizable; se intentará cargar primero ahí.`
      : policy?.npu?.quarantined
        ? ` La NPU Hexagon está en cuarentena tras un cierre (${policy.npu.reason || 'sin detalle'}). Se usará ${gpuUsable ? 'Vulkan' : 'CPU'}; puedes restablecerla en el gestor de modelos.`
        : info.npu && !info.npu.usable
          ? ` La NPU Hexagon no se puede usar aquí: ${info.npu.reason || 'sin sesión HTP'}.${info.gpu?.software ? ' Vulkan solo tiene rasterizador de software.' : ''} Se usará ${gpuUsable ? 'Vulkan' : 'CPU'}.`
          : policy?.gpu?.quarantined
            ? ` La GPU Vulkan está en cuarentena tras un cierre (${policy.gpu.reason || 'sin detalle'}); se usará CPU.`
            : gpuUsable
              ? ` Vulkan detectado (${info.gpu?.name || 'GPU'}); se intentará cargar con aceleración por GPU.`
              : policy?.gpu?.skipped
                ? ` ${policy.gpu.reason || 'Vulkan se omite en este driver; se usará CPU.'}`
                : info.gpu?.software
                  ? ' Vulkan está presente pero es un rasterizador de software; se usará CPU.'
                  : ' Sin NPU ni GPU Vulkan utilizables; se usará CPU.';

    return {
      ok: true,
      latencyMs: Date.now() - started,
      modelAvailable: true,
      models: [this.manifest.archivoDestino],
      detail: `Archivo nativo presente (${sizeMb} MB) en ${info.abi}. Pulsa «Cargar y probar» para verificar que llama.cpp puede ejecutarlo.${accelerationNote}${ramWarning}`,
    };
  }

  async warmUp(signal?: AbortSignal): Promise<BrainHealth> {
    const started = Date.now();

    try {
      await this.ensureLoaded(signal);
      const layerLabel =
        this.resolvedGpuLayers >= 999
          ? 'todas las capas'
          : `${this.resolvedGpuLayers} capa(s)`;
      const accel =
        this.resolvedAcceleration === 'npu'
          ? `NPU Hexagon v${this.resolvedNpuArch || '?'} (${this.resolvedNpuName || 'HTP'}) (${layerLabel})`
          : this.resolvedAcceleration === 'gpu'
            ? `GPU ${this.resolvedGpuName || 'Vulkan'} (${layerLabel})`
            : 'CPU';
      const policyNote = this.resolvedPolicy?.npu?.quarantined
        ? ` La NPU está en cuarentena: ${this.resolvedPolicy.npu.reason || 'cerró la app anteriormente'}.`
        : this.resolvedPolicy?.gpu?.quarantined
          ? ` La GPU está en cuarentena: ${this.resolvedPolicy.gpu.reason || 'cerró la app anteriormente'}.`
          : this.resolvedPolicy?.gpu?.skipped
            ? ` ${this.resolvedPolicy.gpu.reason || 'Vulkan se omite en Adreno.'}`
            : '';
      const fallbackNotes = [
        this.resolvedNpuFallback
          ? ` La NPU no completó la carga: ${this.resolvedNpuError || 'sin detalle del backend Hexagon'}`
          : '',
        this.resolvedGpuFallback
          ? ` El intento con GPU no prosperó: ${this.resolvedGpuError}`
          : '',
        policyNote,
      ].join('');

      return {
        ok: true,
        latencyMs: Date.now() - started,
        modelAvailable: true,
        models: [this.manifest.archivoDestino],
        detail: `Modelo cargado con llama.cpp nativo en ${((Date.now() - started) / 1000).toFixed(1)} s. Contexto ${this.resolvedContext} tokens, ${this.resolvedThreads} hilo(s), aceleración ${accel} (${this.resolvedAbi || 'ABI local'}).${fallbackNotes}`,
      };
    } catch (error) {
      if (signal?.aborted) {
        return { ok: false, latencyMs: Date.now() - started, detail: 'Carga cancelada.' };
      }
      return {
        ok: false,
        latencyMs: Date.now() - started,
        modelAvailable: true,
        detail:
          error instanceof Error
            ? `La carga nativa falló: ${error.message}`
            : 'La carga nativa falló por un error desconocido.',
      };
    }
  }

  private async ensureLoaded(signal?: AbortSignal): Promise<void> {
    if (this.modelReady) return;
    if (!this.loadPromise) {
      this.loadPromise = this.loadInternal(signal).catch((error) => {
        this.loadPromise = null;
        throw error;
      });
    }
    await this.loadPromise;
  }

  private async loadInternal(
    signal?: AbortSignal,
    options?: { cpuOnly?: boolean }
  ): Promise<void> {
    if (signal?.aborted) throw new DOMException('Carga cancelada', 'AbortError');

    const info = await getNativeLlamaInfo();
    if (!info?.available) {
      throw new Error('El motor nativo no está disponible en este APK.');
    }

    const context = CONTEXT_BY_MODEL[this.manifest.id];
    const threads = Math.max(1, Math.min(8, info.recommendedThreads || info.cores - 1 || 4));

    // 999 = todas las capas. Solo se pide cuando queda un acelerador viable
    // tras aplicar la política del plugin (cuarentena y omisión de Vulkan en
    // Adreno). El plugin decide el orden y devuelve qué se usó de verdad.
    // `cpuOnly` se usa al reintentar después de un rechazo en tiempo de
    // ejecución: el acelerador ya está en cuarentena y aquí no se insiste.
    const policy = info.accelerationPolicy;
    // El perfil Q4_0 existe precisamente para usar Vulkan: la política general
    // omite la GPU en Adreno porque los K-quant del resto del catálogo no
    // compilan, pero este archivo sí está verificado. Si la GPU está en
    // cuarentena o no es utilizable, se cae a la política automática.
    const gpuProfile = this.manifest.id === 'ULTRALIGHT_GPU';
    const gpuProfileReady =
      gpuProfile &&
      !options?.cpuOnly &&
      info.gpu?.usable === true &&
      policy?.gpu?.quarantined !== true;
    const accelerated =
      !options?.cpuOnly &&
      (gpuProfileReady ||
        (info.npu?.usable === true && policy?.npu?.usable !== false) ||
        (info.gpu?.usable === true && policy?.gpu?.usable !== false));
    const gpuLayers = accelerated ? 999 : 0;
    const acceleration = options?.cpuOnly ? 'cpu' : gpuProfileReady ? 'gpu' : 'auto';

    const request = {
      fileName: this.manifest.archivoDestino,
      contextTokens: context,
      threads,
      batchTokens: Math.min(512, context),
    };

    let result: Awaited<ReturnType<typeof loadNativeModel>>;
    try {
      result = await loadNativeModel({ ...request, gpuLayers, acceleration });
    } catch (error) {
      if (acceleration !== 'gpu' || signal?.aborted) throw error;
      // El objetivo explícito no retrocede dentro del plugin para no anunciar
      // una GPU que no cargó. Aquí sí: el perfil es opcional y una carga
      // fallida no debe impedir usar el cerebro en CPU.
      this.resolvedGpuFallback = true;
      this.resolvedGpuError =
        error instanceof Error ? error.message : 'La carga en Vulkan falló.';
      result = await loadNativeModel({
        ...request,
        gpuLayers: 0,
        acceleration: 'cpu',
      });
    }

    this.resolvedContext = context;
    this.resolvedThreads = threads;
    this.resolvedAbi = info.abi;
    this.resolvedGpuLayers = result.gpuLayers ?? 0;
    this.resolvedAcceleration =
      result.acceleration ?? (this.resolvedGpuLayers > 0 ? 'gpu' : 'cpu');
    this.resolvedNpuName = result.npu?.name ?? info.npu?.name ?? '';
    this.resolvedNpuArch = result.npu?.arch ?? info.npu?.arch ?? 0;
    this.resolvedNpuFallback = result.npuFallback === true;
    this.resolvedNpuError = result.npuError ?? '';
    this.resolvedGpuName = result.gpu?.name ?? info.gpu?.name ?? '';
    this.resolvedGpuFallback = result.gpuFallback === true;
    this.resolvedGpuError = result.gpuError ?? '';
    this.resolvedPolicy = result.accelerationPolicy ?? info.accelerationPolicy ?? null;
    this.modelReady = true;
  }

  /**
   * Recarga en CPU tras un ACCELERATION_FAILED. El plugin ya liberó la sesión
   * rota y dejó el acelerador en cuarentena; aquí solo se reconstruye el
   * estado del adaptador sin pedir offload.
   */
  private async reloadOnCpu(): Promise<void> {
    this.modelReady = false;
    this.loadPromise = null;
    this.resolvedGpuLayers = 0;
    this.resolvedGpuFallback = false;
    this.resolvedGpuError = '';
    this.resolvedAcceleration = 'cpu';
    try {
      await releaseNativeModel();
    } catch {
      // Liberar es best-effort: el plugin ya cerró la sesión al fallar.
    }
    resetNativeLlamaInfoCache();
    await this.loadInternal(undefined, { cpuOnly: true });
  }

  async chat(
    request: BrainChatRequest,
    onToken?: (token: string) => void,
    signal?: AbortSignal
  ): Promise<BrainChatResult> {
    const started = Date.now();

    if (!this.modelReady) request.onActivity?.('loading');

    try {
      await this.ensureLoaded(signal);
      const info = await getNativeLlamaInfo();
      if (!info?.available) {
        throw new Error('El motor nativo dejó de estar disponible.');
      }

      if (signal?.aborted) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }

      const effort = effortForModel(this.manifest.id);
      const desired = Math.max(32, request.maxTokens || 0);
      const firstChunkCap = Math.min(
        effort.firstChunkTokens,
        NATIVE_OUTPUT_CAP_BY_MODEL[this.manifest.id] ?? effort.firstChunkTokens
      );
      // El contexto se comparte entre prompt y salida. El plan de esfuerzo fija
      // el total del turno; nunca se permite que el presupuesto crezca solo
      // porque el gestor tenga configurado un máximo alto. Así el perfil de
      // bolsillo no encadena bloques ni minutos de espera.
      const totalBudget = Math.max(
        64,
        Math.min(desired, effort.totalTokens, Math.floor(this.resolvedContext * 0.5))
      );

      // El modelo pequeño divaga si recibe una temperatura demasiado baja.
      const temperature = Math.max(
        request.temperature,
        this.manifest.id === 'ULTRALIGHT' || this.manifest.id === 'STANDARD' ? 0.65 : 0.5
      );

      let accumulated = '';
      let generatedTokens = 0;
      let promptTokens = 0;
      let cacheReusedTokens = 0;
      let remainingBudget = totalBudget;
      let chunkIndex = 0;
      let finishReason: 'stop' | 'length' = 'stop';
      let retriedOnCpu = false;

      while (remainingBudget > 0) {
        const chunkBudget = Math.min(remainingBudget, firstChunkCap);
        const messages =
          chunkIndex === 0
            ? fitMessagesForContext(
                request.messages,
                this.resolvedContext,
                chunkBudget,
                false
              )
            : buildContinuationMessages(
                request.messages,
                accumulated,
                this.resolvedContext,
                chunkBudget
              );

        const promptEstimate = messages.reduce(
          (total, message) => total + estimateTokens(message.content),
          0
        );
        if (this.resolvedContext - promptEstimate - 64 < 64) {
          if (!accumulated) {
            throw new Error(
              'El contexto del modelo no deja espacio para la respuesta; reduce el historial o usa un modelo con más contexto.'
            );
          }
          finishReason = 'length';
          break;
        }
        const safeBudget = Math.min(
          chunkBudget,
          Math.max(64, this.resolvedContext - promptEstimate - 64)
        );

        if (import.meta.env.DEV) {
          console.info(
            `[LlamaNative] bloque ${chunkIndex + 1}: prompt ≈ ${promptEstimate} tokens, salida máx. ${safeBudget}`
          );
        }

        request.onActivity?.('prefill');

        const payload = {
          messages,
          maxTokens: safeBudget,
          temperature,
          topP: 0.85,
          topK: 40,
          minP: 0.05,
          repeatPenalty: 1.12,
          frequencyPenalty: 0.15,
          presencePenalty: 0.2,
          penaltyLastN: 64,
        };

        // Se cuenta lo mostrado en este bloque: si el acelerador falla antes
        // de emitir nada, repetir el bloque no duplica texto en pantalla.
        let chunkTokens = 0;
        const emitToken = (token: string) => {
          chunkTokens += 1;
          onToken?.(token);
        };

        let result: Awaited<ReturnType<typeof generateNative>>;
        try {
          result = await generateNative(
            payload,
            emitToken,
            (activity) => request.onActivity?.(activity),
            signal
          );
        } catch (error) {
          if (!isAccelerationFailure(error)) throw error;
          if (chunkTokens > 0 || retriedOnCpu) {
            throw new Error(
              'La GPU/NPU falló a mitad de la respuesta y ya se mostraron tokens. ' +
                'El motor quedó en CPU; vuelve a enviar el mensaje para completar la respuesta.'
            );
          }
          const detail = error instanceof Error ? error.message : '';
          if (import.meta.env.DEV) {
            console.info(`[LlamaNative] ${detail} Reintentando el bloque en CPU.`);
          }
          retriedOnCpu = true;
          request.onActivity?.('loading');
          await this.reloadOnCpu();
          request.onActivity?.('prefill');
          result = await generateNative(
            payload,
            emitToken,
            (activity) => request.onActivity?.(activity),
            signal
          );
        }

        if (signal?.aborted || result.finishReason === 'abort') {
          throw new DOMException('Generación cancelada', 'AbortError');
        }

        const chunkText = sanitizeModelOutput(result.text)
          .replace(/<\|im_end\|>/g, '')
          .replace(/<\|endoftext\|>/g, '')
          .trim();

        if (!chunkText) {
          finishReason = result.finishReason === 'length' ? 'length' : 'stop';
          break;
        }

        accumulated =
          chunkIndex === 0 ? chunkText : joinContinuation(accumulated, chunkText);
        generatedTokens += result.generatedTokens;
        promptTokens = Math.max(promptTokens, result.promptTokens);
        cacheReusedTokens += result.cacheReusedTokens ?? 0;

        if (import.meta.env.DEV) {
          console.info(
            `[LlamaNative] bloque ${chunkIndex + 1}: ${result.generatedTokens} tokens en ` +
              `${(result.generationMs / 1000).toFixed(1)} s (${result.tokensPerSecond.toFixed(2)} tok/s) · ` +
              `prefill ${(result.prefillMs / 1000).toFixed(1)} s · ` +
              `KV ${result.cacheReusedTokens ?? 0}/${result.promptTokens} reutilizados`
          );
        }

        remainingBudget -= Math.max(1, result.generatedTokens);
        finishReason = result.finishReason === 'length' ? 'length' : 'stop';

        if (finishReason === 'stop' || remainingBudget <= 0) break;
        chunkIndex += 1;
        if (chunkIndex > effort.maxContinuations) break;
      }

      if (!accumulated) {
        throw new Error('El modelo nativo devolvió una respuesta vacía.');
      }

      const limitNote =
        effort.maxContinuations > 0
          ? `> **Nota del cerebro local:** se generaron ${generatedTokens} tokens y se alcanzó el límite de este turno incluso después de continuar automáticamente. Pide una sección concreta o usa un modelo mayor.`
          : `> **Nota del cerebro local:** se generaron ${generatedTokens} tokens y se alcanzó el límite de este perfil. Pulsa «Ampliar» o escribe «continúa» para seguir.`;

      const finalText =
        finishReason === 'length' ? `${accumulated}\n\n${limitNote}` : accumulated;

      return {
        text: finalText,
        brainId: this.id,
        provider: 'on-device',
        model: this.manifest.archivoDestino,
        finishReason: finishReason === 'length' ? 'length' : 'stop',
        usage: {
          promptTokens,
          completionTokens: generatedTokens,
          cacheReusedTokens,
        },
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      if (signal?.aborted) {
        throw new DOMException('Generación cancelada', 'AbortError');
      }
      throw error;
    } finally {
      request.onActivity?.('done');
    }
  }

  async release(): Promise<void> {
    this.modelReady = false;
    this.loadPromise = null;
    this.resolvedContext = 0;
    this.resolvedGpuLayers = 0;
    this.resolvedGpuFallback = false;
    this.resolvedGpuError = '';
    this.resolvedNpuFallback = false;
    this.resolvedNpuError = '';
    this.resolvedAcceleration = 'cpu';
    this.resolvedPolicy = null;
    try {
      const info = await getNativeLlamaInfo();
      if (!info?.available) return;
      await releaseNativeModel();
      resetNativeLlamaInfoCache();
    } catch {
      // Liberar memoria es best-effort; Android también puede reciclar el proceso.
    }
  }
}
