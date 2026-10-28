import { CrisisSeverity } from '../shield/types.js';
import {
  DEFAULT_TRADITION,
  DetectedTurnContext,
  DialogueAction,
  DialogueMode,
  DialoguePhase,
  DialogueSlots,
  DialogueState,
  PendingQuestion,
  TurnDecision,
} from './types.js';

export interface CreateDialogueStateOptions {
  mode?: DialogueMode;
  level?: DialogueState['level'];
  tradition?: string;
}

export function createInitialDialogueState(
  options: CreateDialogueStateOptions = {}
): DialogueState {
  return {
    mode: options.mode ?? 'AUTO',
    phase: 'IDLE',
    level: options.level ?? 'Discipulo',
    tradition: options.tradition ?? DEFAULT_TRADITION,
    slots: {},
    approvedPlan: false,
    proposalVersion: 0,
    safetyFlag: 'NONE',
    historySummary: '',
    turnCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

function hasOwn<T extends object>(value: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined;
}

function mergeSlots(current: DialogueSlots, incoming: Partial<DialogueSlots>): DialogueSlots {
  const next: DialogueSlots = { ...current };
  const keys: (keyof DialogueSlots)[] = [
    'task',
    'topic',
    'passage',
    'audience',
    'occasion',
    'format',
    'durationMinutes',
    'tone',
    'goal',
    'constraints',
    'depth',
  ];

  for (const key of keys) {
    if (hasOwn(incoming, key)) {
      // Una tarea genérica de estudio no debe borrar una tarea de documento ya acordada.
      if (key === 'task' && incoming.task === 'estudiar' && current.task && current.task !== 'estudiar') {
        continue;
      }
      (next as Record<string, unknown>)[key] = incoming[key];
    }
  }

  return next;
}

function slotsHaveDocumentContext(slots: DialogueSlots, context: DetectedTurnContext): boolean {
  return Boolean(
    slots.passage ||
      slots.topic ||
      context.bookName ||
      context.characterName ||
      context.doctrineId ||
      context.mirrorId
  );
}

function buildPendingApproval(state: DialogueState): PendingQuestion {
  return {
    slot: 'approval',
    question: '¿Genero el documento con este enfoque o ajustamos algo?',
    options: [
      'Sí, hazlo',
      `Cambiar formato (${state.slots.format ?? 'actual'})`,
      `Cambiar audiencia (${state.slots.audience ?? 'actual'})`,
      'Cambiar pasaje o tema',
    ],
  };
}

function directiveForAction(
  action: DialogueAction,
  state: DialogueState,
  context: DetectedTurnContext
): string {
  const common = [
    `Actúa como teólogo evangélico con hermenéutica histórico-gramatical y como consejero pastoral.`,
    `Nivel del usuario: ${state.level}. Tradición: ${state.tradition}.`,
    `Distingue con claridad entre texto bíblico, interpretación y aplicación.`,
    `No inventes versículos, citas, datos históricos ni hebreo/griego que no puedas sostener.`,
    `Marca cada cita literal con el formato [CITA: Libro Cap:Vers].`,
    `Haz una sola pregunta al final, solo si ayuda a avanzar.`,
  ].join('\n');

  switch (action) {
    case 'ANSWER':
      return [
        common,
        '',
        `Responde directamente la consulta del usuario con precisión y sin rodeos.`,
        context.passage
          ? `El pasaje de trabajo es ${context.passage.book} ${context.passage.chapter}${
              context.passage.verseStart ? `:${context.passage.verseStart}` : ''
            }.`
          : 'Si hay un pasaje pertinente, úsalo; si no, responde desde la doctrina bíblica verificada.',
        'No generes un sermón, una clase ni un documento extenso: esto es una respuesta conversacional.',
      ].join('\n');

    case 'PROPOSE_PLAN':
      return [
        common,
        '',
        'Presenta una propuesta breve de enfoque antes de escribir el documento completo.',
        'No desarrolles todavía el contenido completo.',
      ].join('\n');

    case 'ASK_CLARIFICATION':
      return [
        common,
        '',
        'Haz una sola pregunta breve para completar el dato que falta.',
        'No generes el documento todavía.',
      ].join('\n');

    case 'GENERATE_DOCUMENT': {
      const slots = state.slots;
      const details = [
        slots.topic ? `Tema: ${slots.topic}.` : null,
        slots.passage
          ? `Pasaje base: ${slots.passage.book} ${slots.passage.chapter}${
              slots.passage.verseStart ? `:${slots.passage.verseStart}` : ''
            }${slots.passage.verseEnd ? `-${slots.passage.verseEnd}` : ''}.`
          : null,
        slots.format ? `Formato: ${slots.format}.` : null,
        slots.audience ? `Audiencia: ${slots.audience}.` : null,
        slots.durationMinutes ? `Duración: ${slots.durationMinutes} minutos.` : null,
        slots.depth ? `Profundidad: ${slots.depth}.` : null,
      ]
        .filter(Boolean)
        .join(' ');

      return [
        common,
        '',
        `Genera ahora el documento completo y desarrollado, listo para usar. ${details}`,
        'Incluye introducción, desarrollo en movimientos o secciones, aplicaciones concretas y cierre.',
        'No pidas más confirmaciones: el usuario ya aprobó el enfoque.',
      ].join('\n');
    }

    case 'SMALL_TALK':
      return [common, '', 'Responde al saludo y explica brevemente en qué puedes ayudar.'].join('\n');

    case 'CRISIS_RESPONSE':
      return [
        common,
        '',
        'Prioriza la seguridad emocional. Responde con compasión, sin diagnosticar ni juzgar.',
        'Incluye un paso inmediato de cuidado y recomienda apoyo profesional o líneas de emergencia cuando corresponda.',
      ].join('\n');

    default:
      return common;
  }
}

function withPhase(state: DialogueState, phase: DialoguePhase): DialogueState {
  return {
    ...state,
    phase,
    updatedAt: new Date().toISOString(),
    turnCount: state.turnCount + 1,
  };
}

function actionDecision(
  state: DialogueState,
  action: DialogueAction,
  reason: string,
  context: DetectedTurnContext
): TurnDecision {
  return {
    action,
    state: withPhase(state, phaseForAction(action)),
    directive: directiveForAction(action, state, context),
    reason,
  };
}

function phaseForAction(action: DialogueAction): DialoguePhase {
  switch (action) {
    case 'SMALL_TALK':
      return 'IDLE';
    case 'ANSWER':
      return 'FOLLOW_UP';
    case 'ASK_CLARIFICATION':
      return 'CLARIFY';
    case 'PROPOSE_PLAN':
      return 'PROPOSE';
    case 'GENERATE_DOCUMENT':
      return 'GENERATE';
    case 'CRISIS_RESPONSE':
      return 'FOLLOW_UP';
    case 'CANCELLED':
      return 'FOLLOW_UP';
    default:
      return 'IDLE';
  }
}

function clarificationDecision(
  state: DialogueState,
  pending: PendingQuestion,
  reason: string,
  context: DetectedTurnContext
): TurnDecision {
  const nextState: DialogueState = {
    ...state,
    pendingQuestion: pending,
    phase: 'CLARIFY',
    updatedAt: new Date().toISOString(),
    turnCount: state.turnCount + 1,
  };

  return {
    action: 'ASK_CLARIFICATION',
    state: nextState,
    directive: directiveForAction('ASK_CLARIFICATION', state, context),
    reason,
  };
}

function pendingSlotIsFilled(pending: PendingQuestion, context: DetectedTurnContext): boolean {
  if (pending.slot === 'approval') return false;
  if (pending.slot === 'topic') {
    return Boolean(
      context.slots.topic ||
        context.passage ||
        context.bookName ||
        context.characterName ||
        context.doctrineId ||
        context.mirrorId
    );
  }
  if (pending.slot === 'passage') return Boolean(context.passage || context.bookName);
  return hasOwn(context.slots, pending.slot);
}

function updateStateFromContext(
  baseState: DialogueState,
  context: DetectedTurnContext,
  mode: DialogueMode
): DialogueState {
  const slots = mergeSlots(baseState.slots, context.slots);
  const lastPassage = context.passage ?? baseState.lastPassage;
  const lastTopic = context.slots.topic ?? baseState.lastTopic;

  // Una petición nueva de documento no debe heredar en silencio el tema o el
  // pasaje de una conversación anterior. Si el usuario no aportó un tema,
  // pasaje, personaje o doctrina, se limpia el contexto viejo para preguntar.
  const startsNewDocument =
    !context.followUp &&
    !context.explicitGenerationCue &&
    !context.isAffirmative &&
    !context.isNegative &&
    (context.isDocumentRequest ||
      context.slots.format !== undefined ||
      context.slots.task === 'predicar' ||
      context.slots.task === 'ensenar' ||
      context.slots.task === 'ceremonia');

  const bringsNewFocus = Boolean(
    context.slots.topic ||
      context.passage ||
      context.bookName ||
      context.characterName ||
      context.doctrineId ||
      context.mirrorId
  );

  if (startsNewDocument && !bringsNewFocus) {
    delete slots.topic;
    delete slots.passage;
  }

  return {
    ...baseState,
    mode,
    slots,
    lastPassage,
    lastTopic,
    safetyFlag: baseState.safetyFlag,
    updatedAt: new Date().toISOString(),
  };
}

export interface DecideTurnParams {
  prompt: string;
  state: DialogueState;
  context: DetectedTurnContext;
  mode?: DialogueMode;
  crisisSeverity?: CrisisSeverity;
}

/**
 * Decide qué debe hacer el sistema en este turno. No genera contenido:
 * devuelve la acción, el estado nuevo y la directiva para el cerebro.
 */
export function decideTurn(params: DecideTurnParams): TurnDecision {
  const { prompt, context, crisisSeverity = 'NONE' } = params;
  const mode = params.mode ?? params.state.mode;
  let state = updateStateFromContext(params.state, context, mode);

  // 1. Crisis: la seguridad siempre tiene prioridad sobre cualquier documento.
  if (crisisSeverity === 'CRITICA' || crisisSeverity === 'MEDIA') {
    state = {
      ...state,
      safetyFlag: crisisSeverity,
      pendingQuestion: undefined,
      approvedPlan: false,
    };
    return actionDecision(state, 'CRISIS_RESPONSE', `Crisis ${crisisSeverity} detectada`, context);
  }

  // 2. Respuesta a una pregunta pendiente.
  let answeredPending = false;
  if (state.pendingQuestion) {
    const pending = state.pendingQuestion;

    if (pending.slot === 'approval') {
      const wantsGeneration =
        context.isAffirmative || context.explicitGenerationCue || context.isOverride;

      if (wantsGeneration) {
        state = { ...state, pendingQuestion: undefined, approvedPlan: true };
        return actionDecision(state, 'GENERATE_DOCUMENT', 'El usuario aprobó la propuesta', context);
      }

      if (context.isNegative) {
        const pending: PendingQuestion = {
          slot: 'approval',
          question: 'Entendido. ¿Qué quieres ajustar: el tema, el pasaje, la audiencia o el formato?',
          options: ['Cambiar tema', 'Cambiar pasaje', 'Cambiar audiencia', 'Cambiar formato'],
        };
        state = { ...state, approvedPlan: false };
        return clarificationDecision(state, pending, 'El usuario rechazó la propuesta', context);
      }

      // Si en lugar de aprobar cambió un dato, se actualiza y se vuelve a proponer.
      if (context.slots.format || context.slots.audience || context.slots.passage || context.slots.depth) {
        state = {
          ...state,
          pendingQuestion: buildPendingApproval(state),
          proposalVersion: state.proposalVersion + 1,
        };
        return actionDecision(state, 'PROPOSE_PLAN', 'El usuario ajustó la propuesta', context);
      }

      if (context.isQuestion) {
        state = { ...state, pendingQuestion: undefined };
        return actionDecision(state, 'ANSWER', 'El usuario hizo una pregunta en vez de aprobar', context);
      }
    } else if (pendingSlotIsFilled(pending, context)) {
      state = { ...state, pendingQuestion: undefined };
      answeredPending = true;
    } else if (!context.isQuestion) {
      const refined = {
        slot: pending.slot,
        question: pending.question,
        options: pending.options,
      };
      return clarificationDecision(state, refined, 'Aún falta el dato solicitado', context);
    } else {
      state = { ...state, pendingQuestion: undefined };
    }
  }

  // 3. La aclaración completó el contexto de un documento: proponer el plan.
  const continuingDocument =
    answeredPending &&
    (mode === 'DOCUMENTO' ||
      state.slots.format !== undefined ||
      state.slots.task === 'predicar' ||
      state.slots.task === 'ensenar' ||
      state.slots.task === 'ceremonia');

  if (continuingDocument) {
    state = {
      ...state,
      approvedPlan: false,
      pendingQuestion: buildPendingApproval(state),
      proposalVersion: state.proposalVersion + 1,
    };
    return actionDecision(state, 'PROPOSE_PLAN', 'Contexto completado tras la aclaración', context);
  }

  // 4. Saludo sin contenido adicional.
  if (context.isGreeting) {
    return actionDecision(state, 'SMALL_TALK', 'Saludo inicial', context);
  }

  // 5. Seguimiento de una conversación o de un documento ya generado.
  if (context.followUp) {
    const isDocumentFollowUp =
      state.approvedPlan &&
      (context.followUp === 'format_change' ||
        context.followUp === 'audience_change' ||
        context.followUp === 'length_change' ||
        context.followUp === 'depth_change' ||
        context.followUp === 'more_detail');

    if (isDocumentFollowUp) {
      return actionDecision(
        state,
        'GENERATE_DOCUMENT',
        `Ajuste de documento solicitado: ${context.followUp}`,
        context
      );
    }

    return actionDecision(state, 'ANSWER', `Seguimiento conversacional: ${context.followUp}`, context);
  }

  // 6. El modo explícito de la interfaz manda sobre la heurística,
  // salvo que el texto pida claramente un documento.
  const documentIntent = mode === 'DOCUMENTO' || context.isDocumentRequest;

  if (!documentIntent) {
    if (mode === 'CONSULTA' || mode === 'CONSEJERIA') {
      return actionDecision(state, 'ANSWER', `Modo ${mode}`, context);
    }
    if (mode === 'ESTUDIO') {
      return actionDecision(state, 'ANSWER', 'Modo estudio', context);
    }
  }

  // 7. Petición de documento.
  if (documentIntent) {
    if (context.explicitGenerationCue || context.isOverride) {
      if (!slotsHaveDocumentContext(state.slots, context)) {
        const pending: PendingQuestion = {
          slot: 'topic',
          question: '¿Sobre qué tema o pasaje quieres el documento?',
          options: ['Un pasaje bíblico', 'Una doctrina', 'Un personaje bíblico', 'Una necesidad pastoral'],
        };
        return clarificationDecision(state, pending, 'Falta el tema del documento', context);
      }
      state = { ...state, approvedPlan: true, pendingQuestion: undefined };
      return actionDecision(state, 'GENERATE_DOCUMENT', 'Generación explícita solicitada', context);
    }

    if (!slotsHaveDocumentContext(state.slots, context)) {
      const pending: PendingQuestion = {
        slot: 'topic',
        question: context.slots.format
          ? '¿Sobre qué tema o pasaje quieres preparar ese material?'
          : '¿Qué tema o pasaje quieres trabajar?',
        options: ['Un pasaje bíblico', 'Una doctrina', 'Un personaje bíblico', 'Una necesidad pastoral'],
      };
      return clarificationDecision(state, pending, 'Petición de documento sin tema', context);
    }

    state = {
      ...state,
      approvedPlan: false,
      pendingQuestion: buildPendingApproval(state),
      proposalVersion: state.proposalVersion + 1,
    };
    return actionDecision(state, 'PROPOSE_PLAN', 'Hay contexto suficiente para proponer un plan', context);
  }

  // 8. Consulta directa con contenido claro.
  if (
    context.passage ||
    context.doctrineId ||
    context.characterName ||
    context.mirrorId ||
    context.bookName ||
    context.isQuestion ||
    context.slots.task === 'aconsejar' ||
    context.slots.task === 'estudiar' ||
    context.slots.task === 'doctrinar' ||
    context.slots.task === 'orar'
  ) {
    return actionDecision(state, 'ANSWER', 'Consulta directa', context);
  }

  // 9. Entrada demasiado vaga: una sola pregunta para orientar.
  if (prompt.trim().split(/\s+/).length <= 4) {
    const pending: PendingQuestion = {
      slot: 'topic',
      question: '¿Qué te gustaría hacer: entender un pasaje, estudiar una doctrina, preparar una enseñanza o hablar de algo que estás viviendo?',
      options: ['Entender un pasaje', 'Estudiar una doctrina', 'Preparar una enseñanza', 'Hablar de algo personal'],
    };
    return clarificationDecision(state, pending, 'Entrada ambigua', context);
  }

  return actionDecision(state, 'ANSWER', 'Conversación general', context);
}

/**
 * Marca el estado después de que el orquestador terminó de generar.
 */
export function markTurnCompleted(state: DialogueState, action: DialogueAction): DialogueState {
  if (action === 'CANCELLED') return state;

  return {
    ...state,
    phase: action === 'GENERATE_DOCUMENT' ? 'FOLLOW_UP' : phaseForAction(action),
    approvedPlan: action === 'GENERATE_DOCUMENT' ? true : state.approvedPlan,
    updatedAt: new Date().toISOString(),
  };
}

export function resetDialogueDocumentState(state: DialogueState): DialogueState {
  return {
    ...state,
    approvedPlan: false,
    pendingQuestion: undefined,
    slots: {
      ...state.slots,
      format: undefined,
      durationMinutes: undefined,
      depth: undefined,
    },
    phase: 'FOLLOW_UP',
    updatedAt: new Date().toISOString(),
  };
}
