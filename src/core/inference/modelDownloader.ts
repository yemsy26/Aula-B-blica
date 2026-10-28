import { DownloadProgress, DownloadStatus, ModelManifest } from './types.js';
import { ChunkedDownloader } from './chunkedDownloader.js';
import { NativeModelDownloader, getNativeLlamaInfo } from '../native-bridge/llamaNative.js';

/**
 * Contrato común de descarga de modelos.
 *
 * Hay dos caminos reales:
 * - Nativo (Android): OkHttp escribe el GGUF en filesDir para que llama.cpp
 *   C++ pueda abrirlo con mmap.
 * - OPFS/wllama (PC, web o APK sin biblioteca nativa): bloques HTTP Range
 *   ensamblados en el almacenamiento privado del navegador.
 *
 * La UI usa este contrato y no necesita saber cuál está activo.
 */
export interface ModelDownloader {
  getStatus(): DownloadStatus;
  getProgress(): DownloadProgress;
  isAssembled(): boolean;
  isSha256Verified(): boolean;
  getVerificationNote(): string | undefined;
  getErrorDetail(): string | undefined;
  start(): Promise<boolean>;
  pause(): void;
  resume(): void;
  cancel(): Promise<void>;
}

/**
 * Elige el descargador correcto sin prometer el motor nativo antes de
 * comprobarlo. Si el plugin no está disponible, cae a ChunkedDownloader.
 */
export function createModelDownloader(
  manifest: ModelManifest,
  onProgress?: (progress: DownloadProgress) => void
): ModelDownloader {
  return new NativeModelDownloader(manifest, onProgress, (model, progress) => {
    return new ChunkedDownloader(model, progress);
  });
}

/** Solo para pruebas y diagnóstico: ¿el host expone llama.cpp nativo? */
export async function nativeInferenceAvailable(): Promise<boolean> {
  const info = await getNativeLlamaInfo();
  return info?.available === true;
}
