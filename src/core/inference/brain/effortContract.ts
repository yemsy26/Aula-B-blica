import type { ModelProfileId } from '../types.js';

/**
 * Presupuesto de esfuerzo por perfil.
 *
 * La app ya no deja que un modelo de bolsillo intente escribir todo lo que
 * puede componer el motor verificado. Para el diálogo que sí le corresponde,
 * este contrato fija cuánto puede generar, cuántas veces puede continuar y
 * cuánto historial y texto bíblico recibe. Así el mismo turno no se convierte
 * en tres llamadas largas ni en una espera de minutos.
 */
export interface EffortBudget {
  /** Tope total del turno, sumando todas las continuaciones. */
  totalTokens: number;
  /** Tope del primer bloque. Deja margen para una continuación si el texto se corta. */
  firstChunkTokens: number;
  /** Continuaciones automáticas permitidas después del primer bloque. */
  maxContinuations: number;
  /** Mensajes recientes del historial que se envían al modelo. */
  historyMessages: number;
  /** Versículos completos del contexto verificado. */
  groundTruthVerses: number;
}

export type CompactStyle = 'brief' | 'normal' | 'deep';

const EFFORT_BY_MODEL: Record<ModelProfileId, EffortBudget> = {
  // Un 0.5B no debe encadenar bloques: cada continuación vuelve a pagar el
  // prompt y en GPU 512 tokens son casi un minuto. Una respuesta corta y, si
  // hace falta, una ampliación explícita del usuario.
  ULTRALIGHT: {
    totalTokens: 192,
    firstChunkTokens: 192,
    maxContinuations: 0,
    historyMessages: 2,
    groundTruthVerses: 2,
  },
  ULTRALIGHT_GPU: {
    totalTokens: 192,
    firstChunkTokens: 192,
    maxContinuations: 0,
    historyMessages: 2,
    groundTruthVerses: 2,
  },
  STANDARD: {
    totalTokens: 640,
    firstChunkTokens: 400,
    maxContinuations: 1,
    historyMessages: 4,
    groundTruthVerses: 4,
  },
  ADVANCED_4B: {
    totalTokens: 840,
    firstChunkTokens: 560,
    maxContinuations: 1,
    historyMessages: 6,
    groundTruthVerses: 5,
  },
  MAX_8B: {
    totalTokens: 1040,
    firstChunkTokens: 640,
    maxContinuations: 2,
    historyMessages: 6,
    groundTruthVerses: 5,
  },
};

export const DEFAULT_EFFORT: EffortBudget = EFFORT_BY_MODEL.STANDARD;

export function effortForModel(model: string | undefined): EffortBudget {
  if (model && model in EFFORT_BY_MODEL) {
    return EFFORT_BY_MODEL[model as ModelProfileId];
  }
  return DEFAULT_EFFORT;
}

export function compactStyleFor(effort: EffortBudget): CompactStyle {
  if (effort.totalTokens <= 192) return 'brief';
  if (effort.totalTokens <= 640) return 'normal';
  return 'deep';
}
