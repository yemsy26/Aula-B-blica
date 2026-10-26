export type TheologicalRoute = '[CHARLA_CONSEJERIA]' | '[BUSQUEDA_EXACTA]' | '[CREADOR_ESTUDIO]';

export type UserTheologicalLevel = 'Semilla' | 'Discipulo' | 'Maestro';

export type MinistryFormat =
  | 'AUTO'
  | 'SERMON_CULTO'
  | 'ESTUDIO_CLASE'
  | 'CELULA_JOVENES'
  | 'SERIE_CAMPANA'
  | 'PERFIL_PERSONAJE'
  | 'DOCTRINA_SISTEMATICA'
  | 'CEREMONIA_ESPECIAL'
  | 'CONSEJERIA_DIALOGO';

export type CrisisSeverity = 'NONE' | 'MEDIA' | 'CRITICA';

export interface CrisisDetectionResult {
  isCrisis: boolean;
  severity: CrisisSeverity;
  matchedTriggers: string[];
  immediatePastoralAction?: {
    pastoralMessage: string;
    biblicalAnchors: string[]; // e.g. ["Salmos 34:18", "Jeremías 29:11"]
    helplineRecommendation: string;
  };
}

export interface ShieldProcessingResult {
  originalText: string;
  normalizedText: string;
  detectedRoute: TheologicalRoute;
  detectedLevel: UserTheologicalLevel;
  detectedFormat?: MinistryFormat;
  crisis: CrisisDetectionResult;
  processingTimeMs: number;
  tags: string[];
}
