import { UserTheologicalLevel, TheologicalRoute, MinistryFormat } from '../shield/types.js';
import { UserEvolutionProfile, ChatMessage } from '../database/usuarioMemoriaService.js';

export type ModelProfileId =
  | 'ULTRALIGHT'
  | 'STANDARD'
  | 'ADVANCED_4B'
  | 'MAX_8B'
  // Variante opcional de 0.5B en Q4_0: es la única que el driver Vulkan del
  // Adreno 750 ejecuta con resultados correctos y acelera (~2,4× sobre CPU).
  | 'ULTRALIGHT_GPU';

export interface ModelManifest {
  id: ModelProfileId;
  nombre: string;
  descripcion: string;
  tamanoMb: number;
  cuantizacion: string; // ej: Q3_K_M, Q4_K_M
  tamanoParametros: string; // tamaño real del archivo, ej: 0.5B, 1.5B, 3B, 7B
  contextoMaxTokens: number;
  ramMinimaRequeridaMb: number;
  totalChunks: number;
  tamanoChunkMb: number;
  sha256: string;
  archivoDestino: string;
  url?: string;
  gamaRecomendada?: string;
  esMaximoNivel?: boolean;
}

export type DownloadStatus =
  | 'IDLE'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'ERROR';

export interface DownloadProgress {
  modelId: ModelProfileId;
  status: DownloadStatus;
  chunksDescargados: number;
  totalChunks: number;
  bytesDescargados: number;
  bytesTotales: number;
  porcentaje: number;
  velocidadKbps?: number;
  error?: string;
}

export interface PersonalityConfig {
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  systemPrompt: string;
  stopSequences: string[];
}

export interface InferenceEngine {
  isModelReady(): boolean;
  getActiveModelId(): ModelProfileId | 'DETERMINISTIC';
  generate(
    prompt: string,
    route: TheologicalRoute,
    level: UserTheologicalLevel,
    groundTruthContext?: string,
    onToken?: (token: string) => void,
    userProfile?: UserEvolutionProfile | null,
    format?: MinistryFormat,
    chatHistory?: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string>;
  releaseMemory(): Promise<void>;
}
