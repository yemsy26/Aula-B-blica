import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import { CitationInjector } from '../core/database/citationInjector.js';
import { brainRegistry } from '../core/inference/brain/brainRegistry.js';
import { createInitialDialogueState } from '../core/dialogue/dialogueManager.js';
import { runDialogueTurn } from '../core/dialogue/orchestrator.js';
import { DialogueState } from '../core/dialogue/types.js';

let injector: CitationInjector;

beforeAll(async () => {
  const adapter = await SqlJsDatabaseAdapter.create();
  const biblia = new BibliaCoreService(adapter);
  await biblia.initializeSchemaAndSeeds();
  injector = new CitationInjector(biblia);
});

afterEach(() => {
  brainRegistry.resetForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(() => {
  brainRegistry.resetForTests();
});

function baseParams(prompt: string, state: DialogueState = createInitialDialogueState()) {
  return {
    prompt,
    state,
    forceDeterministic: true,
    injectCitations: (text: string) => injector.injectCitationsInText(text),
  };
}

describe('Orquestador de turno completo', () => {
  it('responde una doctrina directa e inyecta citas literales sin advertencias', async () => {
    const result = await runDialogueTurn(baseParams('¿Qué es la Trinidad?'));

    expect(result.action).toBe('ANSWER');
    expect(result.provider).toBe('deterministic');
    expect(result.text).toContain('La Trinidad');
    expect(result.text).not.toContain('CITA NO ENCONTRADA');
    expect(result.citations && result.citations.length).toBeGreaterThan(0);
    expect(result.text).toContain('Mateo 28:19');
  });

  it('no genera un documento por un saludo aunque el formato esté fijado', async () => {
    const result = await runDialogueTurn({
      ...baseParams('hola'),
      preferredFormat: 'SERMON_CULTO',
    });

    expect(result.action).toBe('SMALL_TALK');
    expect(result.text.length).toBeLessThan(1200);
    expect(result.text).not.toContain('SERMÓN HOMILÉTICO');
  });

  it('propone y luego genera un sermón completo cuando el usuario aprueba', async () => {
    const proposal = await runDialogueTurn(baseParams('prepara un sermón sobre Romanos 8:28'));

    expect(proposal.action).toBe('PROPOSE_PLAN');
    expect(proposal.text).toContain('Propuesta de trabajo');
    expect(proposal.text).toContain('Romanos 8:28');
    expect(proposal.state.pendingQuestion?.slot).toBe('approval');

    const document = await runDialogueTurn(baseParams('hazlo', proposal.state));

    expect(document.action).toBe('GENERATE_DOCUMENT');
    expect(document.text.length).toBeGreaterThan(2500);
    expect(document.text).toContain('SERMÓN');
    expect(document.text).not.toContain('CITA NO ENCONTRADA');
    expect(document.state.phase).toBe('FOLLOW_UP');
    expect(document.state.approvedPlan).toBe(true);
  });

  it('usa solo citas verificadas aunque el libro tenga referencias de catálogo no sembradas', async () => {
    const firstTurn = {
      ...baseParams('prepara un sermón sobre Filipenses 4:6-7'),
      availableCitations: ['Filipenses 4:6-7'],
    };
    const proposal = await runDialogueTurn(firstTurn);

    const document = await runDialogueTurn({
      ...baseParams('hazlo', proposal.state),
      availableCitations: ['Filipenses 4:6-7'],
    });

    expect(document.action).toBe('GENERATE_DOCUMENT');
    expect(document.text).toContain('Filipenses 4:6-7');
    expect(document.text).not.toContain('CITA NO ENCONTRADA');
    expect(document.text).not.toContain('Filipenses 1:21');
    expect(document.text).not.toContain('Filipenses 2:5-11');
    expect(document.text).not.toContain('Filipenses 3:13-14');
  });

  it('propone el plan cuando la audiencia viene incluida en la petición', async () => {
    const proposal = await runDialogueTurn(
      baseParams('prepara un sermón sobre el perdón para jóvenes')
    );

    expect(proposal.action).toBe('PROPOSE_PLAN');
    expect(proposal.text).toContain('Propuesta de trabajo');
    expect(proposal.text).not.toContain('Diálogo Pastoral y Propuesta de Acuerdo');
    expect(proposal.text).toContain('Perdón');
    expect(proposal.text).toContain('Jóvenes');
    expect(proposal.state.slots.audience).toBe('jovenes');
  });

  it('aclara, propone y genera sin contaminar el documento con la palabra «hazlo»', async () => {
    const clarification = await runDialogueTurn(baseParams('quiero predicar el domingo'));
    expect(clarification.action).toBe('ASK_CLARIFICATION');
    expect(clarification.text).toContain('¿Sobre qué tema');

    const proposal = await runDialogueTurn(
      baseParams('sobre el perdón para jóvenes', clarification.state)
    );
    expect(proposal.action).toBe('PROPOSE_PLAN');
    expect(proposal.text).toContain('Perdón');
    expect(proposal.text).toContain('Jóvenes');

    const document = await runDialogueTurn(baseParams('hazlo', proposal.state));
    expect(document.action).toBe('GENERATE_DOCUMENT');
    expect(document.text).toContain('PERDÓN');
    expect(document.text).not.toContain('HAZLO');
    expect(document.state.slots.topic?.toLowerCase()).toContain('perdón');
  });

  it('resuelve una pregunta de seguimiento usando el pasaje anterior', async () => {
    const state: DialogueState = {
      ...createInitialDialogueState(),
      lastPassage: { book: 'Salmos', chapter: 23, verseStart: 1 },
      lastTopic: 'Salmos 23',
    };

    const result = await runDialogueTurn(baseParams('y el versículo 2', state));

    expect(result.action).toBe('ANSWER');
    expect(result.text).toContain('Salmos 23:2');
  });

  it('devuelve una cancelación limpia si la señal ya está abortada', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runDialogueTurn({
      ...baseParams('prepara un sermón sobre la fe'),
      signal: controller.signal,
    });

    expect(result.cancelled).toBe(true);
    expect(result.text).toContain('cancelada');
  });

  it('cae al motor determinista con aviso si el cerebro real falla', async () => {
    brainRegistry.configure({
      provider: 'ollama',
      endpoint: 'http://localhost:59999',
      model: 'modelo-inexistente',
      timeoutMs: 1500,
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('conexión rechazada')));

    const result = await runDialogueTurn({
      ...baseParams('¿Qué es la gracia?'),
      forceDeterministic: false,
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.notice).toContain('no respondió');
    expect(result.text).toContain('La gracia');
    expect(result.text).toContain('Nota:');
  });

  it('envía historial y contrato de prompt al modelo real', async () => {    brainRegistry.configure({
      provider: 'openai-compatible',
      endpoint: 'http://localhost:1234/v1',
      model: 'modelo-local',
      timeoutMs: 5000,
      maxTokens: 800,
    });

    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const messages = body.messages as Array<{ role: string; content: string }>;
      const system = messages.find((message) => message.role === 'system')?.content ?? '';

      // El contrato debe incluir identidad, tradición, slots y reglas de citación.
      expect(system).toContain('VerboVivo');
      expect(system).toContain('histórico-gramatical');
      expect(system).toContain('REGLA DE CITACIÓN');
      expect(system).toContain('Pasaje de trabajo: Salmos 23:1');
      expect(messages.some((message) => message.role === 'assistant')).toBe(true);

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"El Señor es mi pastor y nada me falta."}}]}\n'
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
    });

    vi.stubGlobal('fetch', fetchMock);

    const state: DialogueState = {
      ...createInitialDialogueState(),
      slots: { passage: { book: 'Salmos', chapter: 23, verseStart: 1 }, topic: 'Salmos 23:1' },
      lastPassage: { book: 'Salmos', chapter: 23, verseStart: 1 },
      lastTopic: 'Salmos 23:1',
    };

    const result = await runDialogueTurn({
      prompt: 'explícame este versículo',
      state,
      forceDeterministic: false,
      history: [
        {
          id: '1',
          role: 'user',
          content: 'quiero estudiar el salmo 23',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Empecemos por el primer versículo.',
          timestamp: new Date().toISOString(),
        },
      ],
      injectCitations: (text: string) => injector.injectCitationsInText(text),
    });

    expect(result.provider).toBe('openai-compatible');
    expect(result.fallbackUsed).toBe(false);
    expect(result.text).toContain('El Señor es mi pastor');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('en Android compone la exégesis con el motor verificado sin llamar al modelo', async () => {
    brainRegistry.configure({ provider: 'on-device', model: 'ULTRALIGHT' });

    const result = await runDialogueTurn({
      ...baseParams('explícame Salmos 23:1'),
      forceDeterministic: false,
      availableCitations: ['Salmos 23:1'],
    });

    expect(result.action).toBe('ANSWER');
    expect(result.provider).toBe('on-device');
    expect(result.fallbackUsed).toBe(false);
    expect(result.notice).toContain('motor verificado');
    expect(result.text).toContain('Salmos 23:1');
    expect(result.text).not.toContain('no respondió');
  });
});
