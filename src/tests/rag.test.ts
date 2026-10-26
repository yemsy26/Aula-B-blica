import { describe, it, expect, beforeEach } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import { rewriteTheologicalIntent } from '../core/rag/queryRewriter.js';
import { HybridRetriever } from '../core/rag/hybridRetriever.js';
import { ContextBuilder } from '../core/rag/contextBuilder.js';
import { findBiblicalMirror } from '../core/rag/casuistryMapper.js';
import { localInferenceEngine } from '../core/inference/localEngine.js';

describe('RAG Híbrido - Reescritor de Intención Teológica', () => {
  it('debe mapear situaciones cotidianas de miedo y ansiedad a promesas de paz y libros clave', () => {
    const res = rewriteTheologicalIntent(
      'tengo mucho miedo por el futuro y no puedo dormir de la ansiedad',
      'tengo mucho miedo por el futuro y no puedo dormir de la ansiedad'
    );

    expect(res.temasDetectados.length).toBeGreaterThan(0);
    expect(res.librosSugeridos).toContain('Salmos');
    expect(res.librosSugeridos).toContain('Filipenses');
    expect(res.codigosStrongSugeridos).toContain('H7965'); // Shalom
  });

  it('debe mapear necesidad financiera y desempleo a providencia divina', () => {
    const res = rewriteTheologicalIntent(
      'perdi mi trabajo y no tengo dinero para pagar las deudas',
      'perdí mi trabajo y no tengo dinero para pagar las deudas'
    );

    expect(res.temasDetectados.some((t) => t.includes('Providencia'))).toBe(true);
    expect(res.librosSugeridos).toContain('Mateo');
    expect(res.librosSugeridos).toContain('Proverbios');
  });

  it('debe mapear preguntas de orígenes a la creación ex nihilo y raíces hebreas', () => {
    const res = rewriteTheologicalIntent(
      'como creo dios el universo y la tierra',
      'cómo creó Dios el universo y la tierra'
    );

    expect(res.temasDetectados.some((t) => t.includes('Cosmología') || t.includes('Creación'))).toBe(true);
    expect(res.librosSugeridos).toContain('Génesis');
    expect(res.codigosStrongSugeridos).toContain('H1254'); // Bara
  });
});

describe('RAG Híbrido - Recuperador Ponderado y Expansión Canónica', () => {
  let bibliaService: BibliaCoreService;
  let retriever: HybridRetriever;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
    retriever = new HybridRetriever(bibliaService);
  });

  it('debe recuperar versículos relevantes combinando búsqueda léxica y semántica', () => {
    const rewrite = rewriteTheologicalIntent(
      'necesito paz y descanso para mi alma trabajada',
      'necesito paz y descanso para mi alma trabajada'
    );

    const scored = retriever.retrieve(rewrite, 'Semilla', 4);
    expect(scored.length).toBeGreaterThan(0);

    // Debe incluir o Salmos 23 o Mateo 11:28
    const bookNames = scored.map((s) => s.versiculo.libro_nombre);
    expect(bookNames.includes('Salmos') || bookNames.includes('Mateo')).toBe(true);
    expect(scored[0].puntaje).toBeGreaterThanOrEqual(20);
  });

  it('debe expandir con referencias cruzadas TSK y raíces Strong en nivel Maestro', () => {
    const rewrite = rewriteTheologicalIntent(
      'analiza el principio de la creacion y el logos',
      'analiza el principio de la creación y el logos'
    );

    const scored = retriever.retrieve(rewrite, 'Maestro', 3);
    expect(scored.length).toBeGreaterThan(0);

    const genesisVerse = scored.find((s) => s.versiculo.libro_nombre === 'Génesis');
    if (genesisVerse) {
      expect(genesisVerse.referenciasCruzadas.length).toBeGreaterThan(0);
      expect(genesisVerse.referenciasCruzadas.some((r) => r.destino_libro === 'Juan')).toBe(true);
    }

    // Verificar datos Strong en nivel Maestro
    expect(scored[0].strongData).toBeDefined();
    expect(scored[0].strongData?.length).toBeGreaterThan(0);
  });

  it('debe priorizar y recuperar versículos de Mateo cuando el usuario pide estudiar Mateo', () => {
    const rewrite = rewriteTheologicalIntent(
      'quiero estudiar el libro de mateo que me recomiendas',
      'quiero estudiar el libro de mateo que me recomiendas'
    );
    expect(rewrite.librosSugeridos).toContain('Mateo');

    const scored = retriever.retrieve(rewrite, 'Semilla', 5);
    expect(scored.some((s) => s.versiculo.libro_nombre === 'Mateo')).toBe(true);
  });

  it('debe reconocer y recuperar versículos de Éxodo cuando el usuario pide estudiar Éxodo', () => {
    const rewrite = rewriteTheologicalIntent(
      'quiero estudiar el libro de exodo y el tabernaculo',
      'quiero estudiar el libro de éxodo y el tabernáculo'
    );
    expect(rewrite.librosSugeridos).toContain('Éxodo');

    const scored = retriever.retrieve(rewrite, 'Discipulo', 5);
    expect(scored.some((s) => s.versiculo.libro_nombre === 'Éxodo')).toBe(true);
  });

  it('debe reconocer y recuperar versículos de Apocalipsis ante profecía escatológica', () => {
    const rewrite = rewriteTheologicalIntent(
      'recomiendame un estudio sobre el apocalipsis',
      'recomiéndame un estudio sobre el apocalipsis'
    );
    expect(rewrite.librosSugeridos).toContain('Apocalipsis');

    const scored = retriever.retrieve(rewrite, 'Maestro', 5);
    expect(scored.some((s) => s.versiculo.libro_nombre === 'Apocalipsis')).toBe(true);
  });

  it('debe priorizar con puntuación máxima la cita bíblica exacta cuando el usuario pide salmo 23:1', () => {
    const rewrite = rewriteTheologicalIntent(
      'dame un estudio detallado del salmo 23:1',
      'dame un estudio detallado del salmo 23:1'
    );

    const scored = retriever.retrieve(rewrite, 'Discipulo', 5);
    expect(scored.length).toBeGreaterThan(0);
    // El primer versículo devuelto debe ser exactamente Salmos 23:1
    expect(scored[0].versiculo.libro_nombre).toBe('Salmos');
    expect(scored[0].versiculo.capitulo).toBe(23);
    expect(scored[0].versiculo.versiculo).toBe(1);
    expect(scored[0].versiculo.texto).toContain('JEHOVA es mi pastor');
    expect(scored[0].puntaje).toBe(100);
  });
});

describe('RAG Híbrido - Empaquetador de Contexto y Presupuesto de Tokens', () => {
  let bibliaService: BibliaCoreService;
  let retriever: HybridRetriever;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
    retriever = new HybridRetriever(bibliaService);
  });

  it('debe construir el bloque <SCRIPTURE_GROUND_TRUTH> respetando presupuesto móvil (500 tokens)', () => {
    const rewrite = rewriteTheologicalIntent('amor y salvacion eterna', 'amor y salvación eterna');
    const scored = retriever.retrieve(rewrite, 'Discipulo', 5);

    const context = ContextBuilder.buildGroundTruth(scored, 500, 'Discipulo');

    expect(context.promptContext).toContain('<SCRIPTURE_GROUND_TRUTH>');
    expect(context.promptContext).toContain('</SCRIPTURE_GROUND_TRUTH>');
    expect(context.tokenEstimate).toBeLessThanOrEqual(500);
    expect(context.versiculosIncluidos.length).toBeGreaterThan(0);
  });

  it('debe activar bandera isTruncated si el presupuesto de tokens es muy bajo', () => {
    const rewrite = rewriteTheologicalIntent('salvacion y fe', 'salvación y fe');
    const scored = retriever.retrieve(rewrite, 'Maestro', 10);

    // Presupuesto extremadamente estrecho para forzar truncamiento controlado
    const context = ContextBuilder.buildGroundTruth(scored, 120, 'Maestro');
    expect(context.isTruncated).toBe(true);
  });
});

describe('Motor de Casuística Universal y Diálogo Humano Cero Robot', () => {
  let bibliaService: BibliaCoreService;
  let retriever: HybridRetriever;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
    retriever = new HybridRetriever(bibliaService);
  });

  it('debe mapear crisis financiera y deudas al arquetipo bíblico de la viuda y Eliseo (2 Reyes 4)', () => {
    const mirror = findBiblicalMirror('tengo muchas deudas y los acreedores no me dejan en paz no me alcanza el dinero');
    expect(mirror).not.toBeNull();
    expect(mirror?.categoria).toBe('ECONOMIA_DEUDAS');
    expect(mirror?.referenciaBiblica).toBe('2 Reyes 4:1-7');
    expect(mirror?.personaje).toContain('Eliseo');

    // Comprobar que el RAG recupera versículos de 2 Reyes
    const rewrite = rewriteTheologicalIntent(
      'tengo muchas deudas y me quede sin plata para pagar a los acreedores',
      'tengo muchas deudas y me quedé sin plata para pagar a los acreedores'
    );
    expect(rewrite.librosSugeridos).toContain('2 Reyes');

    const scored = retriever.retrieve(rewrite, 'Semilla', 5);
    expect(scored.some((s) => s.versiculo.libro_nombre === '2 Reyes')).toBe(true);
  });

  it('debe mapear agotamiento extremo y colapso mental a Elías bajo el enebro (1 Reyes 19)', () => {
    const mirror = findBiblicalMirror('estoy con un agotamiento total y una depresion que siento que ya no puedo mas y quiero tirar la toalla');
    expect(mirror).not.toBeNull();
    expect(mirror?.categoria).toBe('AGOTAMIENTO_DEPRESION');
    expect(mirror?.referenciaBiblica).toBe('1 Reyes 19:1-8');
    expect(mirror?.personaje).toContain('Elías');

    // Comprobar que el RAG sugiere 1 Reyes y recupera el pasaje
    const rewrite = rewriteTheologicalIntent(
      'estoy agotado y no puedo mas quiero rendirme de la fatiga',
      'estoy agotado y no puedo más quiero rendirme de la fatiga'
    );
    expect(rewrite.librosSugeridos).toContain('1 Reyes');

    const scored = retriever.retrieve(rewrite, 'Discipulo', 5);
    expect(scored.some((s) => s.versiculo.libro_nombre === '1 Reyes')).toBe(true);
  });

  it('debe generar respuesta bajo el protocolo Cero Robot cerrando con pregunta Ping-Pong', async () => {
    const prompt = 'No tengo dinero para pagar las deudas y los acreedores me tienen desesperado';
    const response = await localInferenceEngine.generate(
      prompt,
      '[CHARLA_CONSEJERIA]',
      'Semilla'
    );

    // 1. Debe incluir la historia espejo y principios
    expect(response).toContain('La Historia Espejo:');
    expect(response).toContain('El Principio Central:');
    expect(response).toContain('Pasos Prácticos');

    // 2. Debe incluir citas canónicas [CITA: ...]
    expect(response).toContain('[CITA: 2 Reyes 4:');

    // 3. Regla del Ping-Pong: debe finalizar con pregunta reflexiva abierta
    expect(response.trim().endsWith('?')).toBe(true);

    // 4. Lista negra de muletillas prohibidas (cero robot)
    const FORBIDDEN_CLICHES = [
      '¡Claro que sí!',
      'Como modelo de inteligencia artificial',
      'Como IA',
      'Es importante destacar que',
      'En conclusión',
      'Aquí tienes la información solicitada',
    ];
    for (const cliche of FORBIDDEN_CLICHES) {
      expect(response).not.toContain(cliche);
    }
  });

  it('debe estructurar un estudio de casuística cuando la ruta es [CREADOR_ESTUDIO]', async () => {
    const response = await localInferenceEngine.generate(
      'quiero un estudio sobre el agotamiento y cuando uno quiere rendirse',
      '[CREADOR_ESTUDIO]',
      'Discipulo'
    );

    expect(response).toContain('### Estudio Bíblico Aplicado:');
    expect(response).toContain('Elías bajo el enebro');
    expect(response).toContain('La Historia Espejo');
    expect(response).toContain('El Principio Doctrinal Central');
    expect(response).toContain('[CITA: 1 Reyes 19:');
    expect(response).toContain('Pregunta para Discipulado');
  });
});
