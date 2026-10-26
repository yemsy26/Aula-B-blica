import { describe, it, expect, beforeEach } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import { CitationInjector } from '../core/database/citationInjector.js';

describe('Protocolo de Inyección Exacta de Citas - 0% Alucinación Doctrinal', () => {
  let injector: CitationInjector;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    const bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
    injector = new CitationInjector(bibliaService);
  });

  it('debe sustituir una etiqueta [CITA: Juan 3:16] por el texto literal canónico', () => {
    const rawAssistantText =
      'Como dice la Escritura: [CITA: Juan 3:16] Y por tanto tenemos paz con Dios.';
    const { processedText, citations } = injector.injectCitationsInText(rawAssistantText);

    expect(citations).toHaveLength(1);
    expect(citations[0].foundInDatabase).toBe(true);
    expect(citations[0].literalText).toContain('Porque de tal manera amó Dios al mundo');

    expect(processedText).toContain('> **«Porque de tal manera amó Dios al mundo');
    expect(processedText).toContain('— *Juan 3:16 (RV1909)*');
  });

  it('debe sustituir rangos de versículos [CITA: Salmos 23:1-2]', () => {
    const raw = 'El salmista nos enseña: [CITA: Salmos 23:1-2] Descansa en Él.';
    const { processedText, citations } = injector.injectCitationsInText(raw);

    expect(citations).toHaveLength(1);
    expect(citations[0].foundInDatabase).toBe(true);
    expect(citations[0].literalText).toContain('(1) JEHOVA es mi pastor');
    expect(citations[0].literalText).toContain('(2) En lugares de delicados pastos');
    expect(processedText).toContain('Salmos 23:1-2 (RV1909)');
  });

  it('debe normalizar abreviaturas dentro de la etiqueta [CITA: jn 3:16]', () => {
    const raw = 'Mira este versículo: [CITA: jn 3:16]';
    const { citations } = injector.injectCitationsInText(raw);

    expect(citations[0].foundInDatabase).toBe(true);
    expect(citations[0].literalText).toContain('Porque de tal manera amó Dios al mundo');
  });

  it('debe manejar citas inexistentes sin alucinar texto', () => {
    const raw = 'Revisa este pasaje: [CITA: Malaquias 99:99]';
    const { processedText, citations } = injector.injectCitationsInText(raw);

    expect(citations[0].foundInDatabase).toBe(false);
    expect(processedText).toContain('[CITA NO ENCONTRADA EN DB LOCAL:');
  });

  it('debe construir el bloque <SCRIPTURE_GROUND_TRUTH> para pre-inyección en el prompt', () => {
    const userInput = 'Por favor explícame qué significa Juan 3:16 y cómo se relaciona con Salmos 23:1';
    const groundTruth = injector.buildScriptureGroundTruth(userInput);

    expect(groundTruth).toContain('<SCRIPTURE_GROUND_TRUTH>');
    expect(groundTruth).toContain('REGLA INQUEBRANTABLE');
    expect(groundTruth).toContain('[CANON_INMUTABLE: Juan 3:16 (RV1909)]');
    expect(groundTruth).toContain('[CANON_INMUTABLE: Salmos 23:1 (RV1909)]');
    expect(groundTruth).toContain('</SCRIPTURE_GROUND_TRUTH>');
  });
});
