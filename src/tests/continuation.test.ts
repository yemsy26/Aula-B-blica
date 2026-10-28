import { describe, expect, it, vi, afterEach } from 'vitest';
import { ChatMessage } from '../core/database/usuarioMemoriaService.js';
import {
  extractContinuationContext,
  isContinuationRequest,
  mergeContinuationText,
  stripLocalLimitNote,
} from '../core/dialogue/continuation.js';
import { createInitialDialogueState } from '../core/dialogue/dialogueManager.js';
import {
  buildBrainMessages,
  buildContinuationMessages,
} from '../core/dialogue/promptContract.js';
import { extractTurnContext } from '../core/dialogue/slotExtractor.js';
import { runDialogueTurn } from '../core/dialogue/orchestrator.js';
import { brainRegistry } from '../core/inference/brain/brainRegistry.js';

function message(role: ChatMessage['role'], content: string, id = `${role}-${content.length}`): ChatMessage {
  return { id, role, content, timestamp: new Date().toISOString() };
}

afterEach(() => {
  brainRegistry.resetForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Detección de «continuar»', () => {
  it('reconoce órdenes de continuar, con o sin acento y con cortesía', () => {
    const valid = [
      'continúa',
      'continuar',
      'Continua por favor',
      'sigue',
      'prosigue',
      'puedes continuar?',
      'continúa donde quedaste',
      'no te detengas',
      'termina la respuesta',
      'el resto',
      '¡Dale!',
    ];

    for (const text of valid) {
      expect(isContinuationRequest(text), text).toBe(true);
    }
  });

  it('no confunde una petición nueva que empieza igual con una continuación', () => {
    const invalid = [
      'continúa el estudio de Juan 3 para jóvenes',
      'sigue explicando la doctrina de la Trinidad',
      'termina el sermón sobre Romanos 8',
      'hola',
      '¿Qué dice Romanos 8:28?',
      '',
    ];

    for (const text of invalid) {
      expect(isContinuationRequest(text), text).toBe(false);
    }
  });
});

describe('Contexto de continuación', () => {
  it('retoma el último par usuario/asistente y quita el aviso de límite', () => {
    const history = [
      message('user', 'Explícame Romanos 8:28'),
      message(
        'assistant',
        'Romanos 8:28 afirma que Dios obra para bien.\n\n> **Nota del cerebro local:** se alcanzó el límite de 640 tokens de este dispositivo. Puedes pedir «continúa».',
        'a1'
      ),
      message('user', 'continúa', 'u2'),
    ];

    const context = extractContinuationContext(history);

    expect(context).not.toBeNull();
    expect(context?.previousUser).toBe('Explícame Romanos 8:28');
    expect(context?.previousAssistant).toContain('Dios obra para bien');
    expect(context?.previousAssistant).not.toContain('límite de 640');
    expect(context?.previousAssistantId).toBe('a1');
  });

  it('devuelve null si aún no hay respuesta del asistente', () => {
    expect(extractContinuationContext([message('user', 'hola')])).toBeNull();
    expect(extractContinuationContext(undefined)).toBeNull();
  });

  it('empalma sin repetir el solape que devuelve el modelo', () => {
    const previous = 'La fe es la certeza de lo que se espera.';
    const addition = 'La fe es la certeza de lo que se espera. Y la convicción de lo que no se ve.';

    expect(mergeContinuationText(previous, addition)).toBe(
      'La fe es la certeza de lo que se espera. Y la convicción de lo que no se ve.'
    );
    expect(mergeContinuationText(previous, 'Y la convicción de lo que no se ve.')).toBe(
      'La fe es la certeza de lo que se espera.\n\nY la convicción de lo que no se ve.'
    );
  });

  it('solo retira el aviso de límite local al empalmar', () => {
    const text =
      'Texto real.\n\n> **Nota del cerebro local:** se alcanzó el límite. Puedes pedir «continúa».';
    expect(stripLocalLimitNote(text)).toBe('Texto real.');

    const noop =
      'Texto real.\n\n> **Nota:** el modelo no añadió texto nuevo al retomar. Vuelve a pulsar «Ampliar».';
    expect(stripLocalLimitNote(noop)).toBe('Texto real.');
  });

  it('no duplica el párrafo completo que el modelo repite al retomar', () => {
    const repeated =
      'La esperanza bíblica no depende de las circunstancias, sino de la fidelidad de Dios.';
    const previous = `Primer párrafo con el contexto.\n\n${repeated}`;
    const addition = `${repeated}\n\nSegundo párrafo que sí aporta contenido nuevo.`;

    expect(mergeContinuationText(previous, addition)).toBe(
      `Primer párrafo con el contexto.\n\n${repeated}\n\nSegundo párrafo que sí aporta contenido nuevo.`
    );
  });

  it('ignora la repetición y devuelve el texto previo si no hay contenido nuevo', () => {
    const repeated =
      'La esperanza bíblica no depende de las circunstancias, sino de la fidelidad de Dios.';
    expect(mergeContinuationText(repeated, repeated)).toBe(repeated);
  });

  it('no duplica la respuesta entera cuando el 3B la reescribe al continuar', () => {
    const previous = [
      'Palabra de ánimo',
      'Hoy, en medio del cansancio y las fuerzas que faltan, recuerda la promesa de Dios: Él vino a ti cuando menos lo esperabas y te dijo que te levantaras y comieras, porque el camino todavía es largo.',
      'Sugerencia para hoy',
      'Cuida tu cuerpo con una breve caminata o tiempo de oración, y recuerda los momentos en que Dios te sacó del desierto y fortaleció tu fe.',
      '¿Necesitas más ayuda para hoy?',
    ].join('\n\n');

    expect(mergeContinuationText(previous, previous)).toBe(previous);
  });
});

describe('Prompt de continuación', () => {
  function compactParams(previousAssistant: string, historySummary: string) {
    const state = createInitialDialogueState();
    const context = extractTurnContext('continúa', {});
    return {
      prompt: 'continúa',
      state,
      context,
      directive: 'Retoma la respuesta anterior donde se cortó.',
      mode: 'AUTO' as const,
      compact: true,
      historySummary,
      previousUser: 'Explícame la parábola del hijo pródigo',
      previousAssistant,
    };
  }

  it('envía la cola de la respuesta y una orden explícita, no solo «continúa»', () => {
    const longAnswer = `${'Contexto histórico. '.repeat(80)}El padre corre al encuentro del hijo.`;
    const messages = buildContinuationMessages(compactParams(longAnswer, 'Usuario: hijo pródigo'));

    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Continúa la respuesta anterior');
    expect(messages[0].content).toContain('CONVERSACIÓN PREVIA');
    expect(messages[0].content).not.toContain('en 1–3 frases');

    expect(messages[1]).toMatchObject({
      role: 'user',
      content: 'Explícame la parábola del hijo pródigo',
    });
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toContain('El padre corre al encuentro del hijo.');
    expect(messages[2].content.startsWith('…')).toBe(true);

    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toContain('Continúa exactamente donde se cortó');
  });

  it('conserva la cola del asistente al cambiar de cerebro y no solo la cabecera', () => {
    const longAnswer = `${'Introducción extensa. '.repeat(60)}Y así llegamos al punto donde se cortó.`;
    const messages = buildBrainMessages({
      ...compactParams(longAnswer, 'Usuario: perdón\nAsistente: Dios perdona'),
      history: [
        message('user', 'Háblame del perdón'),
        message('assistant', longAnswer, 'a1'),
        message('user', 'continúa', 'u2'),
      ],
    });

    const assistant = messages.find((entry) => entry.role === 'assistant');
    expect(assistant?.content).toContain('Y así llegamos al punto donde se cortó.');
    expect(messages[0].content).toContain('CONVERSACIÓN PREVIA');
    expect(messages[0].content).toContain('Dios perdona');
  });
});

describe('Orquestador: continuación tras cambiar de cerebro', () => {
  it('responde retomando la respuesta anterior en vez de saludar', async () => {
    brainRegistry.configure({
      provider: 'openai-compatible',
      endpoint: 'http://localhost:1234/v1',
      model: 'modelo-3b',
      timeoutMs: 5000,
      maxTokens: 900,
    });

    const encoder = new TextEncoder();
    let sentMessages: Array<{ role: string; content: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        sentMessages = body.messages as Array<{ role: string; content: string }>;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"El sufrimiento presente no se compara con la gloria futura."}}]}\n'
              )
            );
            controller.enqueue(encoder.encode('data: [DONE]\n'));
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      })
    );

    const history: ChatMessage[] = [
      message('user', 'Explícame Romanos 8:28', 'u1'),
      message(
        'assistant',
        'Romanos 8:28 enseña que Dios obra para bien en medio del dolor, pero eso no significa que todo lo que ocurre sea bueno. La esperanza cristiana no defrauda.',
        'a1'
      ),
      message('user', 'continúa', 'u2'),
    ];

    const result = await runDialogueTurn({
      prompt: 'continúa',
      state: createInitialDialogueState(),
      history,
      forceDeterministic: false,
    });

    expect(result.continued).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(result.text).toContain('gloria futura');

    const system = sentMessages.find((entry) => entry.role === 'system')?.content ?? '';
    expect(system).toContain('CONTINUIDAD');
    expect(system).not.toContain('Responde al saludo');

    const assistant = sentMessages.find((entry) => entry.role === 'assistant');
    expect(assistant?.content).toContain('La esperanza cristiana no defrauda.');

    const lastUser = sentMessages[sentMessages.length - 1];
    expect(lastUser.content).toContain('Continúa exactamente donde se cortó');
  });
});
