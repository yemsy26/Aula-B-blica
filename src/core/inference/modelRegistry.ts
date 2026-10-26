import { DeviceSystemInfo } from '../native-bridge/types.js';
import { ModelManifest, ModelProfileId } from './types.js';

export const CHUNK_SIZE_MB = 50;

export const AVAILABLE_MODELS: Record<ModelProfileId, ModelManifest> = {
  ULTRALIGHT: {
    id: 'ULTRALIGHT',
    nombre: 'VerboVivo Edge Micro (0.8B Q3_K_M)',
    descripcion: 'Optimizado para dispositivos Android de gama de entrada (2GB - 3GB RAM). Mínima huella de memoria.',
    tamanoMb: 400,
    cuantizacion: 'Q3_K_M',
    tamanoParametros: '0.8B',
    contextoMaxTokens: 1024,
    ramMinimaRequeridaMb: 2048,
    totalChunks: Math.ceil(400 / CHUNK_SIZE_MB), // 8 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    archivoDestino: 'verbovivo_0.8b_q3km.gguf',
  },
  STANDARD: {
    id: 'STANDARD',
    nombre: 'VerboVivo Edge Standard (1.5B Q4_K_M)',
    descripcion: 'Equilibrio perfecto de exégesis profunda y razonamiento bíblico para dispositivos de 4GB+ RAM o PC.',
    tamanoMb: 750,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '1.5B',
    contextoMaxTokens: 2048,
    ramMinimaRequeridaMb: 4096,
    totalChunks: Math.ceil(750 / CHUNK_SIZE_MB), // 15 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    archivoDestino: 'verbovivo_1.5b_q4km.gguf',
  },
};

/**
 * Selecciona el modelo óptimo automáticamente según la telemetría del hardware
 */
export function selectAdaptiveModel(sysInfo: DeviceSystemInfo): ModelManifest {
  // Si la RAM estimada es menor o igual a 3.5 GB (típico teléfono Android de 2GB a 3GB)
  if (sysInfo.estimatedRamMb <= 3500 || sysInfo.isLowEndDevice) {
    return AVAILABLE_MODELS.ULTRALIGHT;
  }
  return AVAILABLE_MODELS.STANDARD;
}
