import { DetectedTurnContext, DialogueAction, DialogueMode } from './types.js';

export interface VerifiedCompositionInput {
  provider: string;
  action: DialogueAction;
  mode: DialogueMode;
  context: DetectedTurnContext;
  continuation: boolean;
}

const STUDY_CUE =
  /estudi|exeges|ex[eé]ges|explic|signific|context|analiz|interpret|ense[nñ]|profundiz|panorama/;

/**
 * Decide si un turno se compone con el motor verificado en lugar de pedirle
 * prosa al modelo local.
 *
 * La regla es deliberadamente conservadora: solo se aplica a Android con motor
 * nativo, a respuestas que ya tienen un pasaje, libro, doctrina, personaje o
 * espejo bíblico identificado, y nunca a una continuación ni a un seguimiento
 * conversacional. El modelo conserva el diálogo abierto y la consejería; la
 * exégesis y el estudio salen de SQLite y del catálogo, donde no hay alucinación
 * y la respuesta llega en milisegundos.
 */
export function shouldComposeVerifiedAnswer(input: VerifiedCompositionInput): boolean {
  if (input.provider !== 'on-device') return false;
  if (input.action !== 'ANSWER') return false;
  if (input.continuation) return false;

  const { context, mode } = input;
  if (context.isGreeting || context.followUp) return false;
  if (context.isDocumentRequest) return false;

  const studyCue =
    context.isQuestion ||
    context.slots.task === 'estudiar' ||
    STUDY_CUE.test(context.normalizedText);

  // En consejería y en un espejo bíblico la calidez del modelo importa más que
  // la ficha exegética. Solo se compone si el usuario pidió explícitamente
  // estudiar o explicar.
  if (!studyCue && (mode === 'CONSEJERIA' || context.mirrorId)) return false;

  // La doctrina o el personaje detectados no bastan por sí solos: «dame ánimo,
  // háblame de la esperanza» menciona una doctrina pero pide acompañamiento.
  // Se exige la misma señal de estudio que para un pasaje.
  if (context.doctrineId || context.characterName) return studyCue;
  if (context.passage || context.bookName) return studyCue;

  return false;
}
