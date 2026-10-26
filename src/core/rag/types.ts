import { VerseSeed, CrossReferenceSeed, StrongSeed } from '../database/seedData.js';

export interface TheologicalTheme {
  id: string;
  nombre: string;
  conceptosClave: string[];
  terminosHumanos: string[]; // Expresiones cotidianas o dolor humano
  librosRecomendados: string[];
  codigosStrongRecomendados: string[];
  versiculosClave: { libro: string; capitulo: number; versiculo: number }[];
}

export interface SemanticRewriteResult {
  queryOriginal: string;
  queryNormalizada: string;
  temasDetectados: string[];
  librosSugeridos: string[];
  codigosStrongSugeridos: string[];
  terminosBusqueda: string[];
}

export interface ScoredVerse {
  versiculo: VerseSeed;
  puntaje: number; // 0 a 100
  fuentesPuntaje: {
    lexicoFts: number;
    semanticoTema: number;
    relevanciaTsk: number;
    pesoNivel: number;
  };
  referenciasCruzadas: CrossReferenceSeed[];
  strongData?: StrongSeed[];
}

export interface GroundTruthContext {
  promptContext: string;
  versiculosIncluidos: ScoredVerse[];
  tokenEstimate: number;
  isTruncated: boolean;
  budgetMaxTokens: number;
}
