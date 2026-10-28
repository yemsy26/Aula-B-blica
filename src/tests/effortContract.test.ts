import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EFFORT,
  compactStyleFor,
  effortForModel,
} from '../core/inference/brain/effortContract.js';
import { shouldComposeVerifiedAnswer } from '../core/dialogue/executionPolicy.js';
import { buildHistoryMessages, buildSystemPrompt } from '../core/dialogue/promptContract.js';
import { createInitialDialogueState } from '../core/dialogue/dialogueManager.js';
import { DetectedTurnContext } from '../core/dialogue/types.js';
import { ChatMessage } from '../core/database/usuarioMemoriaService.js';
import { compositionCache } from '../core/dialogue/compositionCache.js';

function turnContext(overrides: Partial<DetectedTurnContext> = {}): DetectedTurnContext {
  return {
    slots: { topic: 'Salmos 23' },
    passage: { book: 'Salmos', chapter: 23, verseStart: 1 },
    isQuestion: true,
    isGreeting: false,
    isDocumentRequest: false,
    isOverride: false,
    isAffirmative: false,
    isNegative: false,
    explicitGenerationCue: false,
    rawText: 'explícame Salmos 23:1',
    normalizedText: 'explicame salmos 23:1',
    ...overrides,
  };
}

describe('Contrato de esfuerzo por perfil', () => {
  it('el 0.5B no encadena continuaciones y recibe menos historial y contexto', () => {
    const pocket = effortForModel('ULTRALIGHT_GPU');

    expect(pocket.totalTokens).toBe(192);
    expect(pocket.maxContinuations).toBe(0);
    expect(pocket.historyMessages).toBe(2);
    expect(pocket.groundTruthVerses).toBe(2);
    expect(compactStyleFor(pocket)).toBe('brief');
  });

  it('1.5B y 3B permiten una sola continuación y más contexto', () => {
    const standard = effortForModel('STANDARD');
    const advanced = effortForModel('ADVANCED_4B');

    expect(standard.maxContinuations).toBe(1);
    expect(advanced.maxContinuations).toBe(1);
    expect(advanced.totalTokens).toBeGreaterThan(standard.totalTokens);
    expect(compactStyleFor(advanced)).toBe('deep');
  });

  it('un perfil desconocido no queda sin presupuesto', () => {
    expect(effortForModel('desconocido')).toEqual(DEFAULT_EFFORT);
  });
});

describe('Router de ejecución verificado', () => {
  it('compone exégesis de pasaje en el dispositivo sin llamar al modelo', () => {
    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'ESTUDIO',
        context: turnContext(),
        continuation: false,
      })
    ).toBe(true);
  });

  it('deja el diálogo abierto y la consejería al modelo', () => {    const openDialogue = turnContext({
      passage: undefined,
      bookName: undefined,
      slots: {},
      isQuestion: false,
    });

    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'CONSULTA',
        context: openDialogue,
        continuation: false,
      })
    ).toBe(false);

    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'CONSEJERIA',
        context: turnContext({
          isQuestion: false,
          normalizedText: 'estoy leyendo salmos y me siento triste',
        }),
        continuation: false,
      })
    ).toBe(false);
  });

  it('no convierte una petición de ánimo en ficha doctrinal', () => {
    const encouragement = turnContext({
      passage: undefined,
      bookName: undefined,
      doctrineId: 'esperanza',
      isQuestion: false,
      rawText: 'dame animo hoy cuentame una historia larga de esperanza y fe',
      normalizedText: 'dame animo hoy cuentame una historia larga de esperanza y fe',
    });

    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'CONSULTA',
        context: encouragement,
        continuation: false,
      })
    ).toBe(false);

    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'ESTUDIO',
        context: turnContext({
          passage: undefined,
          bookName: undefined,
          doctrineId: 'gracia',
          isQuestion: false,
          rawText: 'explicame la doctrina de la gracia',
          normalizedText: 'explicame la doctrina de la gracia',
        }),
        continuation: false,
      })
    ).toBe(true);
  });

  it('nunca intercepta una continuación ni un seguimiento', () => {
    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'ESTUDIO',
        context: turnContext(),
        continuation: true,
      })
    ).toBe(false);

    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'ANSWER',
        mode: 'ESTUDIO',
        context: turnContext({ followUp: 'more_detail' }),
        continuation: false,
      })
    ).toBe(false);
  });

  it('no actúa fuera del motor on-device ni en documentos', () => {
    expect(
      shouldComposeVerifiedAnswer({
        provider: 'ollama',
        action: 'ANSWER',
        mode: 'ESTUDIO',
        context: turnContext(),
        continuation: false,
      })
    ).toBe(false);

    expect(
      shouldComposeVerifiedAnswer({
        provider: 'on-device',
        action: 'GENERATE_DOCUMENT',
        mode: 'DOCUMENTO',
        context: turnContext({ isDocumentRequest: true }),
        continuation: false,
      })
    ).toBe(false);
  });
});

describe('Contrato compacto con presupuesto', () => {
  const state = createInitialDialogueState();
  const directive = 'Explica el salmo con contexto histórico y aplicación.';
  const groundTruth = [
    '<SCRIPTURE_GROUND_TRUTH>',
    '[CANON_INMUTABLE: Salmos 23:1 (RV1909)]: "Jehová es mi pastor; nada me faltará."',
    '[CANON_INMUTABLE: Salmos 23:2 (RV1909)]: "En lugares de delicados pastos me hará descansar; junto a aguas de reposo me pastoreará."',
    '[CANON_INMUTABLE: Salmos 23:3 (RV1909)]: "Confortará mi alma; me guiará por sendas de justicia por amor de su nombre."',
    '  └─ Conexión Canónica (TSK): Juan 10:11',
    '</SCRIPTURE_GROUND_TRUTH>',
  ].join('\n');

  it('conserva versículos completos y solo los que caben en el presupuesto', () => {
    const compact = buildSystemPrompt({
      state,
      context: turnContext(),
      directive,
      mode: 'ESTUDIO',
      compact: true,
      groundTruthContext: groundTruth,
      effort: effortForModel('ULTRALIGHT'),
    });

    expect(compact).toContain('Salmos 23:1');
    expect(compact).toContain('Salmos 23:2');
    expect(compact).not.toContain('Salmos 23:3');
    expect(compact).toContain('nada me faltará');
    expect(compact).not.toContain('…');
  });

  it('mantiene el prefijo estable y relega el estado del turno al final', () => {
    const first = buildSystemPrompt({
      state,
      context: turnContext(),
      directive: 'Primera tarea.',
      mode: 'ESTUDIO',
      compact: true,
      effort: effortForModel('STANDARD'),
    });
    const second = buildSystemPrompt({
      state,
      context: turnContext(),
      directive: 'Segunda tarea completamente distinta.',
      mode: 'ESTUDIO',
      compact: true,
      effort: effortForModel('STANDARD'),
    });

    const firstTask = first.indexOf('TAREA:');
    const secondTask = second.indexOf('TAREA:');
    expect(firstTask).toBeGreaterThan(0);
    expect(first.slice(0, firstTask)).toBe(second.slice(0, secondTask));
  });

  it('limita el historial al número de mensajes del perfil', () => {
    const history: ChatMessage[] = Array.from({ length: 6 }, (_, index) => ({
      id: `${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Mensaje ${index}`,
      timestamp: new Date().toISOString(),
    }));

    const recent = buildHistoryMessages(history, 'nuevo turno', true, 2);

    expect(recent).toHaveLength(2);
    expect(recent[recent.length - 1].content).toBe('Mensaje 5');
  });
});

describe('Caché de composiciones', () => {
  it('reutiliza el texto y no repite la composición', () => {
    compositionCache.clear();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return 'texto compuesto';
    };

    expect(compositionCache.getOrCreate('clave', factory)).toBe('texto compuesto');
    expect(compositionCache.getOrCreate('clave', factory)).toBe('texto compuesto');
    expect(calls).toBe(1);
    expect(compositionCache.size).toBe(1);
  });
});
