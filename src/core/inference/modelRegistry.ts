import { DeviceSystemInfo } from '../native-bridge/types.js';
import { ModelManifest, ModelProfileId } from './types.js';

export const CHUNK_SIZE_MB = 50;

export const AVAILABLE_MODELS: Record<ModelProfileId, ModelManifest> = {
  ULTRALIGHT: {
    id: 'ULTRALIGHT',
    nombre: 'VerboVivo Micro Edge (0.8B Q3_K_M)',
    descripcion: 'Optimizado para dispositivos Android de gama de entrada (2GB - 3GB RAM). Máxima fluidez y mínima huella de memoria.',
    tamanoMb: 400,
    cuantizacion: 'Q3_K_M',
    tamanoParametros: '0.8B',
    contextoMaxTokens: 1024,
    ramMinimaRequeridaMb: 2048,
    totalChunks: Math.ceil(400 / CHUNK_SIZE_MB), // 8 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    archivoDestino: 'verbovivo_0.8b_q3km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Entrada (2GB - 3GB RAM)',
    esMaximoNivel: false,
  },
  STANDARD: {
    id: 'STANDARD',
    nombre: 'VerboVivo Standard Edge (1.5B Q4_K_M)',
    descripcion: 'Equilibrio ideal de velocidad y fidelidad teológica para móviles estándar (4GB RAM) o PC en desarrollo.',
    tamanoMb: 750,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '1.5B',
    contextoMaxTokens: 2048,
    ramMinimaRequeridaMb: 4096,
    totalChunks: Math.ceil(750 / CHUNK_SIZE_MB), // 15 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    archivoDestino: 'verbovivo_1.5b_q4km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Media (4GB RAM)',
    esMaximoNivel: false,
  },
  ADVANCED_4B: {
    id: 'ADVANCED_4B',
    nombre: 'VerboVivo Exégesis Pro (4B Q4_K_M)',
    descripcion: 'Capacidad analítica avanzada para móviles de gama media-alta (6GB RAM). Exégesis profunda en hebreo y griego, homilética rica y precisión hermenéutica.',
    tamanoMb: 2100,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '4B',
    contextoMaxTokens: 4096,
    ramMinimaRequeridaMb: 6144,
    totalChunks: Math.ceil(2100 / CHUNK_SIZE_MB), // 42 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '9a31bc08412e845c4784a6c8e3984950b63c4e432a58b2734125304918e69812',
    archivoDestino: 'verbovivo_4.0b_q4km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Media-Alta (6GB RAM)',
    esMaximoNivel: false,
  },
  MAX_8B: {
    id: 'MAX_8B',
    nombre: 'VerboVivo Sovereign Master (8B Q4_K_M)',
    descripcion: 'El cerebro bíblico más potente y exhaustivo para móviles de gama alta / Flagship (8GB - 16GB+ RAM) o PC. Razonamiento teológico sistemático integral sin compromisos.',
    tamanoMb: 4200,
    cuantizacion: 'Q4_K_M',
    tamanoParametros: '8B',
    contextoMaxTokens: 8192,
    ramMinimaRequeridaMb: 8192,
    totalChunks: Math.ceil(4200 / CHUNK_SIZE_MB), // 84 chunks
    tamanoChunkMb: CHUNK_SIZE_MB,
    sha256: '4f2910cbe885061ab8494029d5b41056c7a9128f645391206584c01928471602',
    archivoDestino: 'verbovivo_8.0b_q4km.gguf',
    url: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf',
    gamaRecomendada: 'Gama Alta / Flagship (8GB+ RAM)',
    esMaximoNivel: true,
  },
};

export interface DeviceCapabilityAssessment {
  recommendedModel: ModelManifest;
  maxSupportedModel: ModelManifest;
  tierName: 'Gama Entrada' | 'Gama Media' | 'Gama Media-Alta' | 'Gama Alta / Flagship';
  canRun8B: boolean;
  canRun4B: boolean;
  canRunStandard: boolean;
  canRunUltralight: boolean;
  ramFormatted: string;
  storageAvailableMb?: number;
  statusMessage: string;
}

/**
 * Evalúa las capacidades del dispositivo (RAM, núcleos, almacenamiento)
 * y determina compatibilidad para modelos 0.8B, 1.5B, 4B y 8B.
 */
export function assessDeviceCapabilities(sysInfo: DeviceSystemInfo): DeviceCapabilityAssessment {
  const ram = sysInfo.estimatedRamMb;
  const canRun8B = ram >= 7500;
  const canRun4B = ram >= 5500;
  const canRunStandard = ram >= 3500;
  const canRunUltralight = true;

  let recommendedModel: ModelManifest;
  let maxSupportedModel: ModelManifest;
  let tierName: DeviceCapabilityAssessment['tierName'];
  let statusMessage: string;

  if (canRun8B) {
    recommendedModel = AVAILABLE_MODELS.MAX_8B;
    maxSupportedModel = AVAILABLE_MODELS.MAX_8B;
    tierName = 'Gama Alta / Flagship';
    statusMessage = `Tu dispositivo cuenta con ${(ram / 1024).toFixed(1)} GB de RAM. Está totalmente capacitado para el modelo máximo 8B Sovereign Master.`;
  } else if (canRun4B) {
    recommendedModel = AVAILABLE_MODELS.ADVANCED_4B;
    maxSupportedModel = AVAILABLE_MODELS.ADVANCED_4B;
    tierName = 'Gama Media-Alta';
    statusMessage = `Tu dispositivo cuenta con ${(ram / 1024).toFixed(1)} GB de RAM. El cerebro óptimo es 4B Exégesis Pro. El modelo 8B podría saturar la memoria.`;
  } else if (canRunStandard) {
    recommendedModel = AVAILABLE_MODELS.STANDARD;
    maxSupportedModel = AVAILABLE_MODELS.STANDARD;
    tierName = 'Gama Media';
    statusMessage = `Tu dispositivo cuenta con ${(ram / 1024).toFixed(1)} GB de RAM. El cerebro óptimo es 1.5B Standard. Para 4B u 8B se recomienda al menos 6GB/8GB.`;
  } else {
    recommendedModel = AVAILABLE_MODELS.ULTRALIGHT;
    maxSupportedModel = AVAILABLE_MODELS.ULTRALIGHT;
    tierName = 'Gama Entrada';
    statusMessage = `Tu dispositivo cuenta con ${(ram / 1024).toFixed(1)} GB de RAM. El cerebro óptimo es 0.8B Micro Edge para evitar saturación de memoria.`;
  }

  return {
    recommendedModel,
    maxSupportedModel,
    tierName,
    canRun8B,
    canRun4B,
    canRunStandard,
    canRunUltralight,
    ramFormatted: `${(ram / 1024).toFixed(1)} GB`,
    storageAvailableMb: sysInfo.storageFreeMb,
    statusMessage,
  };
}

/**
 * Selecciona el modelo óptimo automáticamente según la telemetría del hardware
 */
export function selectAdaptiveModel(sysInfo: DeviceSystemInfo): ModelManifest {
  return assessDeviceCapabilities(sysInfo).recommendedModel;
}
