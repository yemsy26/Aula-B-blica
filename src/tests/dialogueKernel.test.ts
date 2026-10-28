import { describe, expect, it } from 'vitest';
import {
  createInitialDialogueState,
  decideTurn,
  markTurnCompleted,
} from '../core/dialogue/dialogueManager.js';
import { composeDeterministicAnswer } from '../core/dialogue/deterministicAnswers.js';
import { buildHistoryMessages } from '../core/dialogue/promptContract.js';
import { extractTurnContext } from '../core/dialogue/slotExtractor.js';
import { ChatMessage } from '../core/database/usuarioMemoriaService.js';
import { detectCrisis } from '../core/shield/crisisDetector.js';
import { DialogueState } from '../core/dialogue/types.js';

function decide(prompt: string, state: DialogueState = createInitialDialogueState()) {
  const context = extractTurnContext(prompt, {
    previousPassage: state.lastPassage,
    previousTopic: state.lastTopic,
  });
  return {
    context,
    decision: decideTurn({ prompt, state, context }),
  };
}

describe('Núcleo de diálogo - clasificación y decisión', () => {
  it('responde un saludo sin generar documentos', () => {
    const { decision } = decide('hola');
    expect(decision.action).toBe('SMALL_TALK');
    expect(decision.state.phase).toBe('IDLE');
  });

  it('responde una doctrina directa en lugar de caer en Juan 3:16 genérico', () => {
    const { context, decision } = decide('¿Qué es la Trinidad?');
    expect(context.doctrineId).toBe('trinidad');
    expect(decision.action).toBe('ANSWER');

    const text = composeDeterministicAnswer({
      prompt: '¿Qué es la Trinidad?',
      context,
      state: decision.state,
    });

    expect(text).toContain('La Trinidad');
    expect(text).toContain('Lo que enseña la Escritura');
    expect(text).toContain('[CITA: Mateo 28:19]');
    expect(text).not.toContain('Bosquejo Homilético');
    expect(text).not.toContain('Juan 3:16');
  });

  it('responde la biografía de un personaje con su conexión cristológica', () => {
    const { context, decision } = decide('¿Quién fue el rey David?');
    expect(context.characterName).toBe('David');
    expect(decision.action).toBe('ANSWER');

    const text = composeDeterministicAnswer({
      prompt: '¿Quién fue el rey David?',
      context,
      state: decision.state,
    });

    expect(text).toContain('David');
    expect(text).toContain('Conexión con Cristo');
    expect(text).toContain('Lecciones para hoy');
  });

  it('pide una sola aclaración cuando se pide un sermón sin tema', () => {
    const { decision } = decide('prepara un sermón');
    expect(decision.action).toBe('ASK_CLARIFICATION');
    expect(decision.state.pendingQuestion?.slot).toBe('topic');
    expect(decision.state.pendingQuestion?.question).toContain('¿');
  });

  it('propone un plan cuando hay tema y formato', () => {
    const { decision } = decide('prepara un sermón sobre la ansiedad');
    expect(decision.action).toBe('PROPOSE_PLAN');
    expect(decision.state.pendingQuestion?.slot).toBe('approval');
    expect(decision.state.slots.format).toBe('SERMON_CULTO');
    expect(decision.state.slots.topic?.toLowerCase()).toContain('ansiedad');
  });

  it('propone el plan aunque la audiencia venga en la misma petición', () => {
    const { context, decision } = decide('prepara un sermón sobre el perdón para jóvenes');

    expect(context.followUp).toBeUndefined();
    expect(decision.action).toBe('PROPOSE_PLAN');
    expect(decision.state.slots.topic?.toLowerCase()).toContain('perdón');
    expect(decision.state.slots.audience).toBe('jovenes');
    expect(decision.state.slots.format).toBe('SERMON_CULTO');
  });

  it('genera el documento cuando el usuario aprueba la propuesta', () => {
    const proposed = decide('prepara un sermón sobre la ansiedad').decision;
    const { decision } = decide('hazlo', proposed.state);

    expect(decision.action).toBe('GENERATE_DOCUMENT');
    expect(decision.state.approvedPlan).toBe(true);
    expect(decision.state.pendingQuestion).toBeUndefined();
  });

  it('conserva el tema del sermón al aprobar con «hazlo»', () => {
    const proposed = decide('prepara un sermón sobre la ansiedad').decision;
    const { decision } = decide('hazlo', proposed.state);

    expect(decision.state.slots.topic?.toLowerCase()).toContain('ansiedad');
    expect(decision.state.slots.topic?.toLowerCase()).not.toContain('hazlo');
  });

  it('pide el tema cuando solo se indica la ocasión («predicar el domingo»)', () => {
    const { decision } = decide('quiero predicar el domingo');

    expect(decision.action).toBe('ASK_CLARIFICATION');
    expect(decision.state.pendingQuestion?.slot).toBe('topic');
    expect(decision.state.slots.topic).toBeUndefined();
  });

  it('no arrastra el tema de una conversación anterior a un documento nuevo', () => {
    const previous = decide('¿Qué es la Trinidad?').decision;
    const state: DialogueState = { ...previous.state, lastTopic: 'Trinidad' };
    const { decision } = decide('quiero predicar el domingo', state);

    expect(decision.state.slots.topic).toBeUndefined();
    expect(decision.action).toBe('ASK_CLARIFICATION');
  });

  it('al responder la aclaración de tema propone el plan en lugar de responder genérico', () => {
    const first = decide('quiero predicar el domingo').decision;
    expect(first.action).toBe('ASK_CLARIFICATION');
    expect(first.state.pendingQuestion?.slot).toBe('topic');

    const { decision } = decide('sobre el perdón para jóvenes', first.state);

    expect(decision.action).toBe('PROPOSE_PLAN');
    expect(decision.state.slots.topic?.toLowerCase()).toContain('perdón');
    expect(decision.state.slots.audience).toBe('jovenes');
    expect(decision.state.slots.format).toBe('SERMON_CULTO');
    expect(decision.state.pendingQuestion?.slot).toBe('approval');
  });

  it('mantiene el tema y la audiencia al aprobar la propuesta aclarada', () => {
    const first = decide('quiero predicar el domingo').decision;
    const proposed = decide('sobre el perdón para jóvenes', first.state).decision;
    const { decision } = decide('hazlo', proposed.state);

    expect(decision.action).toBe('GENERATE_DOCUMENT');
    expect(decision.state.slots.topic?.toLowerCase()).toContain('perdón');
    expect(decision.state.slots.audience).toBe('jovenes');
    expect(decision.state.slots.topic?.toLowerCase()).not.toContain('hazlo');
  });

  it('no genera un documento cuando solo se pregunta qué es un sermón', () => {
    const { context, decision } = decide('¿Qué es un sermón?');
    expect(context.isDocumentRequest).toBe(false);
    expect(decision.action).toBe('ANSWER');
  });

  it('un formato explícito no convierte un saludo en documento', () => {
    const state = createInitialDialogueState();
    const context = extractTurnContext('hola', { preferredFormat: 'SERMON_CULTO' });
    const decision = decideTurn({ prompt: 'hola', state, context });
    expect(decision.action).toBe('SMALL_TALK');
  });

  it('resuelve seguimientos de versículo sobre el pasaje anterior', () => {
    const state: DialogueState = {
      ...createInitialDialogueState(),
      lastPassage: { book: 'Salmos', chapter: 23, verseStart: 1 },
      lastTopic: 'Salmos 23',
      phase: 'FOLLOW_UP',
    };

    const { context, decision } = decide('y el versículo 2', state);
    expect(context.passage).toEqual({ book: 'Salmos', chapter: 23, verseStart: 2 });
    expect(decision.action).toBe('ANSWER');
  });

  it('regenera un documento al cambiar la audiencia después de generarlo', () => {
    let state = decide('prepara un sermón sobre la ansiedad').decision.state;
    state = decide('hazlo', state).decision.state;
    state = markTurnCompleted(state, 'GENERATE_DOCUMENT');

    const { context, decision } = decide('hazlo para jóvenes', state);
    expect(context.followUp).toBe('audience_change');
    expect(decision.action).toBe('GENERATE_DOCUMENT');
    expect(decision.state.slots.audience).toBe('jovenes');
  });

  it('mantiene una sola pregunta de cierre en respuestas deterministas', () => {
    const { context, decision } = decide('explícame la justificación');
    const text = composeDeterministicAnswer({
      prompt: 'explícame la justificación',
      context,
      state: decision.state,
    });

    const questionCount = (text.match(/¿/g) || []).length;
    expect(questionCount).toBe(1);
  });
});

describe('Presupuesto de contexto para modelos de bolsillo', () => {
  it('recorta el historial a los últimos cuatro mensajes en modo compacto', () => {
    const history: ChatMessage[] = Array.from({ length: 12 }, (_, index) => ({
      id: `msg_${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Mensaje ${index}`,
      timestamp: new Date().toISOString(),
    }));

    const compact = buildHistoryMessages(history, 'nuevo turno', true);
    const expanded = buildHistoryMessages(history, 'nuevo turno', false);

    expect(compact).toHaveLength(4);
    expect(expanded).toHaveLength(12);
    expect(compact[compact.length - 1].content).toBe('Mensaje 11');
  });

  it('no reenvía al modelo las notas del sistema ni el marcador de elisión', () => {
    const note =
      '\n\n> **Nota del cerebro local:** se generaron 640 tokens y se alcanzó el límite. Pulsa «Ampliar» o escribe «continúa» para seguir.';
    const history: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'háblame de la esperanza',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'a1',
        role: 'assistant',
        content: `La esperanza sostiene al creyente en la prueba.\n[…]\nSigue firme hasta el final.${note}`,
        timestamp: new Date().toISOString(),
      },
    ];

    const messages = buildHistoryMessages(history, 'dame ánimo hoy', true);
    const assistant = messages.find((entry) => entry.role === 'assistant');

    expect(assistant?.content).toContain('La esperanza sostiene');
    expect(assistant?.content).toContain('Sigue firme hasta el final.');
    expect(assistant?.content).not.toContain('Nota del cerebro local');
    expect(assistant?.content).not.toContain('Ampliar');
    expect(assistant?.content).not.toContain('[…]');
  });

  it('en modo compacto conserva solo el final de la respuesta anterior', () => {
    const longAnswer = `Apertura única de la respuesta. ${'Desarrollo distinto. '.repeat(
      40
    )}El punto exacto donde se cortó.`;
    const history: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'explícame la parábola',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'a1',
        role: 'assistant',
        content: longAnswer,
        timestamp: new Date().toISOString(),
      },
    ];

    const compact = buildHistoryMessages(history, 'continúa', true);
    const assistant = compact.find((entry) => entry.role === 'assistant');

    expect(assistant?.content).toContain('El punto exacto donde se cortó.');
    expect(assistant?.content.length).toBeLessThan(400);
    expect(assistant?.content).not.toContain('Apertura única');
  });
});

describe('Detección de crisis sin falsos positivos', () => {
  it('no marca como crisis una negación explícita', () => {
    expect(detectCrisis('no quiero morir').isCrisis).toBe(false);
    expect(detectCrisis('no quiero matarme').isCrisis).toBe(false);
    expect(detectCrisis('no tengo intención de suicidarme').isCrisis).toBe(false);
  });

  it('no marca como crisis un modismo cotidiano', () => {
    expect(detectCrisis('me quiero morir de risa').isCrisis).toBe(false);
    expect(detectCrisis('quiero morir de risa con ese video').isCrisis).toBe(false);
  });

  it('sí detecta una negación de vivir como crisis', () => {
    expect(detectCrisis('ya no quiero vivir').isCrisis).toBe(true);
    expect(detectCrisis('no quiero seguir viviendo').isCrisis).toBe(true);
    expect(detectCrisis('no quiero vivir más').isCrisis).toBe(true);
  });

  it('sí detecta una intención directa', () => {
    const result = detectCrisis('quiero morir');
    expect(result.isCrisis).toBe(true);
    expect(result.severity).toBe('CRITICA');
  });

  it('no convierte una pregunta informativa sobre el suicidio en crisis personal', () => {
    expect(detectCrisis('¿Qué dice la Biblia sobre el suicidio?').isCrisis).toBe(false);
  });
});
