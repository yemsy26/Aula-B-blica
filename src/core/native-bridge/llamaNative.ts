import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { AVAILABLE_MODELS } from '../inference/modelRegistry.js';
import { DownloadProgress, DownloadStatus, ModelManifest, ModelProfileId } from '../inference/types.js';
import type { ModelDownloader } from '../inference/modelDownloader.js';

/**
 * Puente JS con el motor llama.cpp nativo de Android.
 *
 * En PC/web el plugin no existe: todas las funciones devuelven `null` o
 * rechazan y la app usa wllama/WASM. En Android, si la biblioteca nativa no
 * está empaquetada para el ABI, `available` es false y tampoco se finge que
 * el motor está listo.
 */

export interface NativeModelFile {
  fileName: string;
  sizeBytes: number;
}

export interface NativeGpuInfo {
  /** llama.cpp encontró un backend Vulkan. */
  available: boolean;
  /** GPU real: se puede usar para offload sin mentir sobre la aceleración. */
  usable: boolean;
  /** Rasterizador de software (SwiftShader/llvmpipe): no acelera de verdad. */
  software: boolean;
  name: string;
  description: string;
  type?: string;
  memoryFreeMb?: number;
  memoryTotalMb?: number;
  supportsOffload?: boolean;
  /** Perfil de compatibilidad Vulkan aplicado antes de inicializar ggml. */
  vulkanProfile?: string;
}

export interface NativeNpuInfo {
  /** El APK incluye el backend Hexagon y el SoC expone una NPU compatible. */
  available: boolean;
  /** La NPU se pudo abrir y admite offload real de capas. */
  usable: boolean;
  vendor: string;
  soc: string;
  /** Versión de Hexagon (73, 75, 79, 81, 85); 0 si no se pudo determinar. */
  arch: number;
  name: string;
  description: string;
  memoryFreeMb?: number;
  memoryTotalMb?: number;
  /** Motivo explícito cuando available/usable es false. */
  reason?: string;
  /** Diagnóstico técnico del enlazador/FastRPC; no se muestra en la interfaz. */
  detail?: string;
}

export type NativeAcceleration = 'npu' | 'gpu' | 'cpu';

export interface NativeAcceleratorState {
  /** Se puede usar en modo automático (ya descuenta cuarentena y omisiones). */
  usable: boolean;
  /** Este acelerador cerró la app y se evita hasta restablecerlo. */
  quarantined: boolean;
  /** Se omite por una incompatibilidad conocida del driver, no por un fallo. */
  skipped: boolean;
  reason?: string;
  phase?: 'probe' | 'load' | 'runtime' | '';
}

/**
 * Política real aplicada por el plugin. En Adreno, Vulkan se omite en modo
 * automático porque su driver ha cerrado la app al compilar pipelines; se usa
 * la NPU Hexagon o la CPU. Un acelerador que mata el proceso se pone en
 * cuarentena hasta que el usuario la restablezca.
 */
export interface NativeAccelerationPolicy {
  mode?: 'auto' | 'cpu' | 'npu' | 'gpu';
  npu?: NativeAcceleratorState;
  gpu?: NativeAcceleratorState;
}

export interface NativeLlamaInfo {
  available: boolean;
  abi: string;
  supportedAbis: string[];
  cores: number;
  recommendedThreads: number;
  totalRamMb: number;
  freeStorageMb: number;
  ready: boolean;
  loadedFileName: string;
  models: NativeModelFile[];
  runtime?: string;
  gpu?: NativeGpuInfo;
  npu?: NativeNpuInfo;
  acceleration?: NativeAcceleration;
  gpuLayers?: number;
  gpuFallback?: boolean;
  npuFallback?: boolean;
  npuError?: string;
  accelerationPolicy?: NativeAccelerationPolicy;
}

export interface NativeLoadResult {
  ok: boolean;
  cached?: boolean;
  context: number;
  threads: number;
  loadMs: number;
  gpu?: NativeGpuInfo;
  npu?: NativeNpuInfo;
  gpuLayers?: number;
  gpuFallback?: boolean;
  gpuError?: string;
  npuFallback?: boolean;
  npuError?: string;
  acceleration?: NativeAcceleration;
  accelerationPolicy?: NativeAccelerationPolicy;
}

export interface NativeGenerateRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repeatPenalty?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  penaltyLastN?: number;
  seed?: number;
}

export interface NativeGenerateResult {
  text: string;
  finishReason: 'stop' | 'length' | 'abort';
  promptTokens: number;
  generatedTokens: number;
  /** Tokens del prompt que ya estaban en la caché KV nativa. */
  cacheReusedTokens?: number;
  prefillMs: number;
  generationMs: number;
  tokensPerSecond: number;
}

export interface NativeDownloadResult {
  ok: boolean;
  fileName?: string;
  sizeBytes?: number;
  paused?: boolean;
  cancelled?: boolean;
  bytes?: number;
  sha256Verified?: boolean;
}

interface NativeDownloadEvent {
  fileName: string;
  bytes: number;
  totalBytes: number;
  percent: number;
  phase: 'downloading' | 'verifying' | 'done';
  done: boolean;
  error?: string;
}

interface NativeTokenEvent {
  token: string;
  index: number;
}

interface NativeActivityEvent {
  activity: 'prefill' | 'generating';
}

interface LlamaNativePlugin {
  getInfo(): Promise<NativeLlamaInfo>;
  listModels(): Promise<{ models: NativeModelFile[] }>;
  downloadModel(options: {
    fileName: string;
    url: string;
    expectedBytes?: number;
    sha256?: string;
  }): Promise<NativeDownloadResult>;
  pauseDownload(options: { fileName: string }): Promise<void>;
  cancelDownload(options: { fileName: string }): Promise<void>;
  deleteModel(options: { fileName: string }): Promise<{ ok: boolean; removed: boolean }>;
  loadModel(options: {
    fileName: string;
    contextTokens: number;
    threads: number;
    batchTokens?: number;
    /** -1 = automático; 0 = CPU; 999 = todas las capas en GPU/NPU. */
    gpuLayers?: number;
    /** Política del plugin; por defecto `auto` (NPU → GPU/Adereno omitido → CPU). */
    acceleration?: 'auto' | 'cpu' | 'npu' | 'gpu';
  }): Promise<NativeLoadResult>;
  generate(options: NativeGenerateRequest): Promise<NativeGenerateResult>;
  cancelGeneration(): Promise<void>;
  /** Descarta la caché KV sin recargar el modelo (conversación nueva). */
  resetCache(): Promise<void>;
  release(): Promise<void>;
  resetAcceleration(): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listener: (event: NativeDownloadEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'llamaToken',
    listener: (event: NativeTokenEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'llamaActivity',
    listener: (event: NativeActivityEvent) => void
  ): Promise<PluginListenerHandle>;
}

const LlamaNative = registerPlugin<LlamaNativePlugin>('LlamaNative');

let cachedInfo: NativeLlamaInfo | null | undefined;

export function isAndroidNativeHost(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

/**
 * Consulta única del motor nativo. El resultado se cachea porque cargar la
 * lista de modelos y la RAM real en cada render sería desperdicio.
 */
export async function getNativeLlamaInfo(force = false): Promise<NativeLlamaInfo | null> {
  if (!isAndroidNativeHost()) return null;
  if (!force && cachedInfo !== undefined) return cachedInfo;

  try {
    const info = await LlamaNative.getInfo();
    cachedInfo = info && typeof info.available === 'boolean' ? info : null;
  } catch {
    cachedInfo = null;
  }

  return cachedInfo;
}

export function resetNativeLlamaInfoCache(): void {
  cachedInfo = undefined;
}

export async function listNativeModels(force = false): Promise<NativeModelFile[]> {
  const info = await getNativeLlamaInfo(force);
  if (!info?.available) return [];
  try {
    const result = await LlamaNative.listModels();
    return Array.isArray(result.models) ? result.models : [];
  } catch {
    return [];
  }
}

export function modelIdForFileName(fileName: string): ModelProfileId | null {
  const match = Object.values(AVAILABLE_MODELS).find(
    (manifest) => manifest.archivoDestino.toLowerCase() === fileName.trim().toLowerCase()
  );
  return match?.id ?? null;
}

/** Ids de perfiles que existen en el almacenamiento nativo. */
export async function listInstalledNativeModelIds(): Promise<ModelProfileId[]> {
  const files = await listNativeModels(true);
  const ids = files
    .map((file) => modelIdForFileName(file.fileName))
    .filter((id): id is ModelProfileId => id !== null);

  return Array.from(new Set(ids));
}

export async function hasNativeModel(fileName: string): Promise<boolean> {
  const files = await listNativeModels();
  return files.some((file) => file.fileName === fileName);
}

export async function loadNativeModel(options: {
  fileName: string;
  contextTokens: number;
  threads: number;
  batchTokens?: number;
  gpuLayers?: number;
  acceleration?: 'auto' | 'cpu' | 'npu' | 'gpu';
}): Promise<NativeLoadResult> {
  return LlamaNative.loadModel(options);
}

/**
 * Vuelve a permitir NPU/GPU después de una cuarentena por cierre nativo. La
 * app las probará de nuevo; si el driver sigue fallando, se cuarentenan otra
 * vez para no dejar la aplicación inutilizable.
 */
export async function resetNativeAcceleration(): Promise<void> {
  if (!isAndroidNativeHost()) return;
  await LlamaNative.resetAcceleration();
  resetNativeLlamaInfoCache();
}

/**
 * Etiqueta corta y honesta de la aceleración. Se usa en la UI para no afirmar
 * «GPU»/«NPU» cuando Vulkan es un rasterizador de software, cuando no hay
 * backend Hexagon o cuando el offload terminó en CPU.
 */
export function describeNativeAcceleration(info: {
  gpu?: NativeGpuInfo;
  npu?: NativeNpuInfo;
  acceleration?: NativeAcceleration;
  accelerationPolicy?: NativeAccelerationPolicy;
} | null): string {
  if (!info) return 'CPU';
  if (info.acceleration === 'npu') {
    return info.npu?.name ? `NPU ${info.npu.name}` : 'NPU Hexagon';
  }
  if (info.acceleration === 'gpu') {
    return info.gpu?.name ? `GPU ${info.gpu.name}` : 'GPU Vulkan';
  }

  // Sin modelo cargado, acceleration es «cpu» por defecto; se explica la
  // política que se aplicará, no un retroceso que todavía no ha ocurrido.
  const policy = info.accelerationPolicy;
  if (policy?.npu?.quarantined && policy?.gpu?.quarantined) {
    return 'CPU (NPU y GPU bloqueadas tras un cierre)';
  }
  if (policy?.npu?.quarantined) return 'CPU (NPU bloqueada tras un cierre)';
  if (policy?.gpu?.quarantined) return 'CPU (GPU bloqueada tras un cierre)';
  if (policy?.gpu?.skipped) return 'CPU (Vulkan omitido en Adreno)';
  if (info.npu?.usable) return 'CPU (retroceso desde NPU)';
  if (info.gpu?.software) return 'CPU (Vulkan de software)';
  if (info.gpu?.usable) return 'CPU (retroceso desde GPU)';
  if (info.npu?.available) return 'CPU (NPU no utilizable)';
  if (info.gpu?.available) return 'CPU (GPU no utilizable)';
  return 'CPU';
}

export async function generateNative(
  request: NativeGenerateRequest,
  onToken?: (token: string) => void,
  onActivity?: (activity: NativeActivityEvent['activity']) => void,
  signal?: AbortSignal
): Promise<NativeGenerateResult> {
  const tokenListener = onToken
    ? await LlamaNative.addListener('llamaToken', (event) => {
        if (typeof event.token === 'string' && event.token.length > 0) onToken(event.token);
      })
    : null;

  const activityListener = onActivity
    ? await LlamaNative.addListener('llamaActivity', (event) => {
        if (event.activity === 'prefill' || event.activity === 'generating') {
          onActivity(event.activity);
        }
      })
    : null;

  const cancel = () => {
    void LlamaNative.cancelGeneration().catch(() => undefined);
  };

  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });

  try {
    const result = await LlamaNative.generate(request);
    return result;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await tokenListener?.remove();
    await activityListener?.remove();
  }
}

export async function cancelNativeGeneration(): Promise<void> {
  if (!isAndroidNativeHost()) return;
  try {
    await LlamaNative.cancelGeneration();
  } catch {
    // Sin generación activa no hay nada que cancelar.
  }
}

/**
 * Descarta el KV nativo. Se llama al empezar una conversación nueva: el modelo
 * sigue cargado, pero la respuesta no hereda el contexto de la anterior. Es
 * perezoso: el JNI lo aplica antes del próximo prompt.
 */
export async function resetNativeCache(): Promise<void> {
  if (!isAndroidNativeHost()) return;
  try {
    await LlamaNative.resetCache();
  } catch {
    // Sin motor nativo no hay caché que descartar.
  }
}

export async function releaseNativeModel(): Promise<void> {
  if (!isAndroidNativeHost()) return;
  try {
    await LlamaNative.release();
  } catch {
    // Sin modelo cargado no hay nada que liberar.
  }
}

export async function deleteNativeModel(fileName: string): Promise<boolean> {
  if (!(await getNativeLlamaInfo())?.available) return false;
  try {
    const result = await LlamaNative.deleteModel({ fileName });
    resetNativeLlamaInfoCache();
    return result.removed;
  } catch {
    return false;
  }
}

/**
 * Descargador nativo. Mantiene el mismo contrato que ChunkedDownloader para
 * que la UI no sepa qué motor descarga, pero escribe en filesDir porque
 * llama.cpp C++ no puede abrir rutas de OPFS.
 */
export class NativeModelDownloader implements ModelDownloader {
  private readonly manifest: ModelManifest;
  private readonly onProgressCallback?: (progress: DownloadProgress) => void;
  private transient: ModelDownloader | null = null;
  private status: DownloadStatus = 'IDLE';
  private bytesDownloaded = 0;
  private totalBytes: number;
  private errorDetail: string | undefined;
  private paused = false;
  private cancelled = false;

  constructor(
    manifest: ModelManifest,
    onProgress?: (progress: DownloadProgress) => void,
    fallbackFactory?: (manifest: ModelManifest, onProgress?: (progress: DownloadProgress) => void) => ModelDownloader
  ) {
    this.manifest = manifest;
    this.onProgressCallback = onProgress;
    this.totalBytes = Math.max(1, Math.round(manifest.tamanoMb * 1024 * 1024));
    this.fallbackFactory = fallbackFactory;
  }

  private readonly fallbackFactory?: (
    manifest: ModelManifest,
    onProgress?: (progress: DownloadProgress) => void
  ) => ModelDownloader;

  getStatus(): DownloadStatus {
    return this.transient ? this.transient.getStatus() : this.status;
  }

  isAssembled(): boolean {
    return this.transient ? this.transient.isAssembled() : this.status === 'COMPLETED';
  }

  isSha256Verified(): boolean {
    return this.transient?.isSha256Verified() ?? false;
  }

  getVerificationNote(): string | undefined {
    return this.transient?.getVerificationNote();
  }

  getErrorDetail(): string | undefined {
    return this.transient?.getErrorDetail() ?? this.errorDetail;
  }

  getProgress(): DownloadProgress {
    if (this.transient) return this.transient.getProgress();
    return this.buildProgress();
  }

  private buildProgress(): DownloadProgress {
    const percentage = this.status === 'COMPLETED'
      ? 100
      : Math.min(99, Math.round((this.bytesDownloaded / this.totalBytes) * 100));
    const chunkBytes = Math.max(1, this.manifest.tamanoChunkMb * 1024 * 1024);

    return {
      modelId: this.manifest.id,
      status: this.status,
      chunksDescargados: Math.min(
        this.manifest.totalChunks,
        Math.floor(this.bytesDownloaded / chunkBytes)
      ),
      totalChunks: this.manifest.totalChunks,
      bytesDescargados: this.bytesDownloaded,
      bytesTotales: this.totalBytes,
      porcentaje: Number.isFinite(percentage) ? Math.max(0, percentage) : 0,
      error: this.errorDetail,
    };
  }

  private notify(): void {
    this.onProgressCallback?.(this.getProgress());
  }

  async start(): Promise<boolean> {
    if (this.status === 'DOWNLOADING') return false;

    this.paused = false;
    this.cancelled = false;
    this.errorDetail = undefined;
    this.status = 'DOWNLOADING';
    this.notify();

    const info = await getNativeLlamaInfo();
    if (!info?.available) {
      if (!this.fallbackFactory) {
        this.status = 'ERROR';
        this.errorDetail = 'El motor nativo no está disponible y no hay descargador alternativo.';
        this.notify();
        return false;
      }

      // APK antiguo o ABI sin biblioteca: conservamos el camino OPFS/wllama.
      this.transient = this.fallbackFactory(this.manifest, this.onProgressCallback);
      return this.transient.start();
    }

    const url = this.manifest.url;
    if (!url) {
      this.status = 'ERROR';
      this.errorDetail = 'El catálogo no define una URL de descarga para este modelo.';
      this.notify();
      return false;
    }

    let listener: PluginListenerHandle | null = null;

    try {
      listener = await LlamaNative.addListener('downloadProgress', (event) => {
        if (event.fileName !== this.manifest.archivoDestino) return;
        this.bytesDownloaded = Math.max(0, event.bytes || 0);
        if (event.totalBytes > 0) this.totalBytes = event.totalBytes;

        if (event.phase === 'verifying') this.status = 'VERIFYING';
        else if (event.done) this.status = 'COMPLETED';
        else if (!this.cancelled && !this.paused) this.status = 'DOWNLOADING';

        this.notify();
      });

      const result = await LlamaNative.downloadModel({
        fileName: this.manifest.archivoDestino,
        url,
        expectedBytes: Math.round(this.manifest.tamanoMb * 1024 * 1024),
        sha256: this.manifest.sha256 || undefined,
      });

      if (result.cancelled) {
        this.status = 'IDLE';
        this.bytesDownloaded = 0;
        this.notify();
        return false;
      }

      if (result.paused) {
        this.status = 'PAUSED';
        this.bytesDownloaded = result.bytes ?? this.bytesDownloaded;
        this.notify();
        return false;
      }

      if (!result.ok) {
        this.status = 'ERROR';
        this.errorDetail = 'La descarga nativa no se completó.';
        this.notify();
        return false;
      }

      if (result.sizeBytes && result.sizeBytes > 0) this.totalBytes = result.sizeBytes;
      this.bytesDownloaded = result.sizeBytes ?? this.bytesDownloaded;
      this.status = 'COMPLETED';
      resetNativeLlamaInfoCache();
      this.notify();
      return true;
    } catch (error) {
      this.status = this.cancelled ? 'IDLE' : 'ERROR';
      this.errorDetail =
        error instanceof Error ? error.message : 'La descarga nativa falló por un error desconocido.';
      this.notify();
      return false;
    } finally {
      await listener?.remove();
    }
  }

  pause(): void {
    if (this.transient) {
      this.transient.pause();
      return;
    }
    this.paused = true;
    this.status = 'PAUSED';
    this.notify();
    void LlamaNative.pauseDownload({ fileName: this.manifest.archivoDestino }).catch(() => undefined);
  }

  resume(): void {
    if (this.transient) {
      this.transient.resume();
      return;
    }
    if (this.status === 'PAUSED' || this.status === 'ERROR') void this.start();
  }

  async cancel(): Promise<void> {
    if (this.transient) {
      await this.transient.cancel();
      return;
    }

    this.cancelled = true;
    this.paused = false;
    this.status = 'IDLE';
    this.bytesDownloaded = 0;
    this.errorDetail = undefined;
    await LlamaNative.cancelDownload({ fileName: this.manifest.archivoDestino }).catch(
      () => undefined
    );
    resetNativeLlamaInfoCache();
    this.notify();
  }
}
