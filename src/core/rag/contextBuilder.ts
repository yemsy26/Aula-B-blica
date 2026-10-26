import { ScoredVerse, GroundTruthContext } from './types.js';
import { UserTheologicalLevel } from '../shield/types.js';

export class ContextBuilder {
  /**
   * Estima la cantidad de tokens de un texto en español (promedio 1 token ~ 4 caracteres)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Empaqueta los versículos recuperados dentro del bloque <SCRIPTURE_GROUND_TRUTH>
   * Respetando el presupuesto estricto de tokens de dispositivos móviles básicos.
   */
  static buildGroundTruth(
    scoredVerses: ScoredVerse[],
    maxTokenBudget: number = 600,
    userLevel: UserTheologicalLevel = 'Semilla'
  ): GroundTruthContext {
    const headerLines = [
      '<SCRIPTURE_GROUND_TRUTH>',
      'REGLA CANÓNICA INMUTABLE (0% ALUCINACIÓN):',
      'Tienes prohibido citar versículos bíblicos de memoria. Debes utilizar única y exclusivamente',
      'los textos literales provistos a continuación, referenciándolos con la etiqueta exacta: [CITA: Libro Cap:Vers].',
      '',
    ];

    const includedVerses: ScoredVerse[] = [];
    const contextLines: string[] = [...headerLines];
    let currentTokens = this.estimateTokens(headerLines.join('\n'));
    let isTruncated = false;

    for (const item of scoredVerses) {
      const v = item.versiculo;
      const verseLine = `[CANON_INMUTABLE: ${v.libro_nombre} ${v.capitulo}:${v.versiculo} (${v.version})]: "${v.texto}"`;
      const verseTokens = this.estimateTokens(verseLine);

      // Comprobar si cabe en el presupuesto
      if (currentTokens + verseTokens > maxTokenBudget - 50) {
        isTruncated = true;
        break;
      }

      contextLines.push(verseLine);
      currentTokens += verseTokens;
      includedVerses.push(item);

      // Si el nivel es Discípulo o Maestro, incluir referencias cruzadas TSK si caben
      if ((userLevel === 'Discipulo' || userLevel === 'Maestro') && item.referenciasCruzadas.length > 0) {
        const tskList = item.referenciasCruzadas
          .slice(0, 2)
          .map((r) => `${r.destino_libro} ${r.destino_capitulo}:${r.destino_versiculo}`)
          .join(', ');
        const tskLine = `  └─ Conexión Canónica (TSK): ${tskList}`;
        const tskTokens = this.estimateTokens(tskLine);

        if (currentTokens + tskTokens <= maxTokenBudget - 40) {
          contextLines.push(tskLine);
          currentTokens += tskTokens;
        }
      }

      // Si el nivel es Maestro, incluir notas Strong
      if (userLevel === 'Maestro' && item.strongData && item.strongData.length > 0) {
        for (const s of item.strongData.slice(0, 2)) {
          const strongLine = `  └─ Raíz Léxica [${s.codigo} ${s.transliteracion} (${s.idioma})]: ${s.definicion.slice(0, 100)}...`;
          const sTokens = this.estimateTokens(strongLine);
          if (currentTokens + sTokens <= maxTokenBudget - 30) {
            contextLines.push(strongLine);
            currentTokens += sTokens;
          }
        }
      }

      contextLines.push('');
    }

    contextLines.push('</SCRIPTURE_GROUND_TRUTH>');
    const finalPromptContext = contextLines.join('\n');
    const finalTokens = this.estimateTokens(finalPromptContext);

    return {
      promptContext: finalPromptContext,
      versiculosIncluidos: includedVerses,
      tokenEstimate: finalTokens,
      isTruncated,
      budgetMaxTokens: maxTokenBudget,
    };
  }
}
