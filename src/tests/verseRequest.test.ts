import { beforeEach, describe, expect, it } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import { CitationInjector } from '../core/database/citationInjector.js';
import { HybridRetriever } from '../core/rag/hybridRetriever.js';
import { rewriteTheologicalIntent } from '../core/rag/queryRewriter.js';
import { isSimpleVerseRequest, resolveVerifiedVerse } from '../core/rag/verseRequest.js';
import { createInitialDialogueState } from '../core/dialogue/dialogueManager.js';
import { runDialogueTurn } from '../core/dialogue/orchestrator.js';

describe('Peticiones directas de versículo', () => {
  let bibliaService: BibliaCoreService;
  let retriever: HybridRetriever;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
    retriever = new HybridRetriever(bibliaService);
  });

  function resolve(prompt: string) {
    const rewrite = rewriteTheologicalIntent(prompt, prompt.toLowerCase());
    const fallback = retriever.retrieve(rewrite, 'Semilla', 5);
    return resolveVerifiedVerse(prompt, bibliaService, fallback, 'Semilla');
  }

  it('distingue una petición de cita de una petición de explicación', () => {
    expect(isSimpleVerseRequest('Dame un versículo corto sobre la paz.')).toBe(true);
    expect(isSimpleVerseRequest('¿Qué dice la Biblia sobre la paz?')).toBe(true);
    expect(isSimpleVerseRequest('Explícame el versículo Juan 3:16.')).toBe(false);
    expect(isSimpleVerseRequest('Prepara un sermón sobre Filipenses 4:6-7.')).toBe(false);
  });

  it('resuelve la paz con un texto que realmente contiene la palabra paz', () => {
    const verse = resolve('Dame un versículo corto sobre la paz.');

    expect(verse).not.toBeNull();
    expect(verse?.text.toLowerCase()).toContain('paz');
    expect(verse?.reference).not.toBe('Salmos 23:4');
    expect(['Filipenses 4:7', 'Romanos 5:1', 'Hebreos 13:20']).toContain(verse?.reference);

    // La cita debe existir literalmente en la base local: no se inventa texto.
    const stored = bibliaService.getVerse(verse!.book, verse!.chapter, verse!.verse);
    expect(stored?.texto).toBe(verse?.text);
  });

  it('resuelve el amor con un texto que contiene la palabra amor', () => {
    const verse = resolve('Dame un versículo sobre el amor de Dios.');

    expect(verse).not.toBeNull();
    expect(verse?.text.toLowerCase()).toContain('amor');
    expect(verse?.reference).toMatch(/^1 Juan 4:/);
  });

  it('usa el versículo que el RAG ya consideró relevante cuando no hay término literal', () => {
    const verse = resolve('Dame un versículo sobre la ansiedad.');

    expect(verse).not.toBeNull();
    // Filipenses 4:7 / Mateo 11:28 son las anclas recuperadas para ansiedad.
    expect(['Filipenses 4:7', 'Mateo 11:28', 'Filipenses 4:6']).toContain(verse?.reference);
  });

  it('el orquestador responde con la cita verificada y no delega la transcripción al modelo', async () => {
    const verse = resolve('Dame un versículo corto sobre la paz.');
    const injector = new CitationInjector(bibliaService);

    const result = await runDialogueTurn({
      prompt: 'Dame un versículo corto sobre la paz.',
      state: createInitialDialogueState({ mode: 'AUTO', level: 'Semilla' }),
      preferredLevel: 'Semilla',
      verifiedVerse: verse,
      injectCitations: (raw) => injector.injectCitationsInText(raw, 'RV1909'),
    });

    expect(result.action).toBe('ANSWER');
    expect(result.fallbackUsed).toBe(false);
    expect(result.text).toContain('«');
    expect(result.text).toContain(verse!.text);
    expect(result.text).toContain(verse!.reference);
    expect(result.text).not.toContain('[CITA:');
    expect(result.notice).toContain('verificada');
  });
});
