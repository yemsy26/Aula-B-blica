import { UserTheologicalLevel } from '../shield/types.js';

export interface DailyBreadCardData {
  id: string;
  fecha: string;
  temaRelacionado: string;
  versiculoReferencia: string;
  versiculoTexto: string;
  version: string;
  reflexionPastoral: string;
  preguntaDelDia: string;
  nivelUsuario: UserTheologicalLevel;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  schemaVersion: number;
  integrityHash: string;
  chats: unknown[];
  profile: unknown;
  studies: unknown[];
}

export interface BackupRestoreResult {
  success: boolean;
  totalChatsRestored: number;
  totalStudiesRestored: number;
  error?: string;
}
