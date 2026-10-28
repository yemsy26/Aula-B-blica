import { MinistryFormat, UserTheologicalLevel } from '../shield/types.js';

export type DialogueMode = 'AUTO' | 'CONSULTA' | 'ESTUDIO' | 'CONSEJERIA' | 'DOCUMENTO';

export type DialoguePhase =
  | 'IDLE'
  | 'DISCOVER'
  | 'CLARIFY'
  | 'PROPOSE'
  | 'CONFIRM'
  | 'GENERATE'
  | 'FOLLOW_UP';

export type DialogueTask =
  | 'responder'
  | 'estudiar'
  | 'predicar'
  | 'ensenar'
  | 'aconsejar'
  | 'doctrinar'
  | 'ceremonia'
  | 'orar';

export type DialogueAudience =
  | 'ninos'
  | 'jovenes'
  | 'adultos'
  | 'lideres'
  | 'congregacion'
  | 'personal'
  | 'matrimonios'
  | 'mujeres'
  | 'hombres';

export type DialogueTone = 'pastoral' | 'academico' | 'didactico' | 'solemne';

export interface PassageRef {
  book: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}

export interface DialogueSlots {
  task?: DialogueTask;
  topic?: string;
  passage?: PassageRef;
  audience?: DialogueAudience;
  occasion?: string;
  format?: MinistryFormat;
  durationMinutes?: number;
  tone?: DialogueTone;
  goal?: string;
  constraints?: string[];
  depth?: 'breve' | 'normal' | 'profundo';
}

export interface PendingQuestion {
  slot: keyof DialogueSlots | 'approval';
  question: string;
  options?: string[];
}

export interface DialogueState {
  mode: DialogueMode;
  phase: DialoguePhase;
  level: UserTheologicalLevel;
  tradition: string;
  slots: DialogueSlots;
  lastPassage?: PassageRef;
  lastTopic?: string;
  pendingQuestion?: PendingQuestion;
  approvedPlan: boolean;
  proposalVersion: number;
  safetyFlag: 'NONE' | 'MEDIA' | 'CRITICA';
  historySummary: string;
  turnCount: number;
  updatedAt: string;
}

export type DialogueAction =
  | 'SMALL_TALK'
  | 'ANSWER'
  | 'ASK_CLARIFICATION'
  | 'PROPOSE_PLAN'
  | 'GENERATE_DOCUMENT'
  | 'CRISIS_RESPONSE'
  | 'CANCELLED';

export type FollowUpKind =
  | 'next_verse'
  | 'audience_change'
  | 'format_change'
  | 'length_change'
  | 'depth_change'
  | 'chapter_change'
  | 'more_detail'
  | 'other';

export interface DetectedTurnContext {
  slots: Partial<DialogueSlots>;
  passage?: PassageRef;
  bookName?: string;
  characterName?: string;
  mirrorId?: string;
  doctrineId?: string;
  isQuestion: boolean;
  isGreeting: boolean;
  isDocumentRequest: boolean;
  isOverride: boolean;
  isAffirmative: boolean;
  isNegative: boolean;
  followUp?: FollowUpKind;
  explicitGenerationCue: boolean;
  rawText: string;
  normalizedText: string;
}

export interface TurnDecision {
  action: DialogueAction;
  state: DialogueState;
  directive: string;
  reason: string;
}

export interface DialogueTurnResult {
  text: string;
  state: DialogueState;
  action: DialogueAction;
  brainId: string;
  brainLabel: string;
  provider: string;
  fallbackUsed: boolean;
  notice?: string;
  cancelled?: boolean;
  /**
   * El turno retomó la respuesta anterior: la interfaz debe ampliar el mensaje
   * previo del asistente en lugar de crear una burbuja nueva.
   */
  continued?: boolean;
  /**
   * El turno agotó el presupuesto del perfil. La interfaz ofrece «Ampliar»
   * en lugar de obligar al usuario a escribir «continúa».
   */
  truncated?: boolean;
  citations?: string[];
  shield?: unknown;
}

export const DEFAULT_TRADITION =
  'Cristianismo evangélico, hermenéutica histórico-gramatical, lectura canónica centrada en Cristo';
