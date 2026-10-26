import { ChatMessage } from '../database/usuarioMemoriaService.js';
import { UserTheologicalLevel } from '../shield/types.js';

export interface DistilledMemorySnapshot {
  temasExtraidos: string[];
  dudasDetectadas: string[];
  versiculosClave: string[];
  nivelPercibido: UserTheologicalLevel;
  sintesisCruceGlobal: string; // Resumen conciso < 300 palabras
  timestamp: string;
}

export interface CompressionJob {
  chatId: string;
  messages: ChatMessage[];
  timestamp: number;
}
