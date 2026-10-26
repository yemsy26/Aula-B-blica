import { BibliaCoreService } from './bibliaCoreService.js';
import { normalizeLinguisticDialect } from '../shield/normalizer.js';

// Regex que detecta tags explícitos: [CITA: Juan 3:16], [CITA: Génesis 1:1-3], [CITA: Salmos 23:1]
const CITA_TAG_REGEX = /\[CITA:\s*([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d+):(\d+)(?:-(\d+))?\]/gi;

// Regex para detectar referencias bíblicas naturales en el texto: "Juan 3:16", "Salmos 23:1-4", "1 Corintios 13:4"
const NATURAL_REFERENCE_REGEX = /\b([1-3]?\s*[A-ZÁÉÍÓÚ][a-záéíóúñ]+)\s+(\d+)[:.](\d+)(?:-(\d+))?\b/g;

export interface InjectedCitation {
  rawTag: string;
  book: string;
  chapter: number;
  startVerse: number;
  endVerse?: number;
  literalText: string;
  formattedBlock: string;
  foundInDatabase: boolean;
}

/**
 * Protocolo de Inyección Exacta
 * Asegura 0% alucinación doctrinal sustituyendo marcas [CITA: ...] con el texto canónico literal de SQLite.
 */
export class CitationInjector {
  private bibliaService: BibliaCoreService;

  constructor(bibliaService: BibliaCoreService) {
    this.bibliaService = bibliaService;
  }

  /**
   * Resuelve e inyecta un solo versículo o rango de versículos
   */
  resolveVerseOrRange(
    rawBook: string,
    chapter: number,
    startVerse: number,
    endVerse?: number,
    version: string = 'RV1909'
  ): { text: string; found: boolean; formattedReference: string } {
    // Normalizar abreviaturas como "Jn" -> "Juan", "1co" -> "1 Corintios"
    const normalizedBook = normalizeLinguisticDialect(rawBook.trim());

    if (endVerse && endVerse > startVerse) {
      const verses = this.bibliaService.getVerseRange(
        normalizedBook,
        chapter,
        startVerse,
        endVerse,
        version
      );
      if (verses.length > 0) {
        const text = verses.map((v) => `(${v.versiculo}) ${v.texto}`).join(' ');
        return {
          text,
          found: true,
          formattedReference: `${verses[0].libro_nombre} ${chapter}:${startVerse}-${endVerse} (${version})`,
        };
      }
    } else {
      const single = this.bibliaService.getVerse(normalizedBook, chapter, startVerse, version);
      if (single) {
        return {
          text: single.texto,
          found: true,
          formattedReference: `${single.libro_nombre} ${chapter}:${startVerse} (${version})`,
        };
      }
    }

    return {
      text: '',
      found: false,
      formattedReference: `${normalizedBook} ${chapter}:${startVerse}${endVerse ? `-${endVerse}` : ''}`,
    };
  }

  /**
   * Procesa un texto y reemplaza todas las etiquetas `[CITA: Libro Cap:Vers]` con el texto literal inmutable
   */
  injectCitationsInText(text: string, version: string = 'RV1909'): { processedText: string; citations: InjectedCitation[] } {
    const citations: InjectedCitation[] = [];

    const processedText = text.replace(
      CITA_TAG_REGEX,
      (match, bookStr, chapterStr, startVerseStr, endVerseStr) => {
        const chapter = parseInt(chapterStr, 10);
        const startVerse = parseInt(startVerseStr, 10);
        const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : undefined;

        let resolved = this.resolveVerseOrRange(bookStr, chapter, startVerse, endVerse, version);

        // Fallback a RV1909 si la versión secundaria no tiene ese versículo indexado
        if (!resolved.found && version !== 'RV1909') {
          const fallback = this.resolveVerseOrRange(bookStr, chapter, startVerse, endVerse, 'RV1909');
          if (fallback.found) {
            resolved = fallback;
          }
        }

        let formattedBlock = '';
        if (resolved.found) {
          formattedBlock = `\n> **«${resolved.text}»**\n> — *${resolved.formattedReference}*\n`;
        } else {
          formattedBlock = `\n> ⚠️ *[CITA NO ENCONTRADA EN DB LOCAL: ${resolved.formattedReference}]*\n`;
        }

        citations.push({
          rawTag: match,
          book: bookStr.trim(),
          chapter,
          startVerse,
          endVerse,
          literalText: resolved.text,
          formattedBlock,
          foundInDatabase: resolved.found,
        });

        return formattedBlock;
      }
    );

    return { processedText, citations };
  }

  /**
   * Prepara el bloque de contexto <SCRIPTURE_GROUND_TRUTH> para inyectar en el prompt del LLM Edge
   * Busca citas implícitas en la pregunta del usuario y precarga su texto literal de SQLite.
   */
  buildScriptureGroundTruth(inputText: string, version: string = 'RV1909'): string {
    const normalized = normalizeLinguisticDialect(inputText);
    const matches = Array.from(normalized.matchAll(NATURAL_REFERENCE_REGEX));

    if (matches.length === 0) {
      return '';
    }

    const groundTruthEntries: string[] = [];

    for (const m of matches) {
      const rawBook = m[1];
      const chapter = parseInt(m[2], 10);
      const startVerse = parseInt(m[3], 10);
      const endVerse = m[4] ? parseInt(m[4], 10) : undefined;

      let resolved = this.resolveVerseOrRange(rawBook, chapter, startVerse, endVerse, version);
      if (!resolved.found && version !== 'RV1909') {
        const fallback = this.resolveVerseOrRange(rawBook, chapter, startVerse, endVerse, 'RV1909');
        if (fallback.found) {
          resolved = fallback;
        }
      }

      if (resolved.found) {
        groundTruthEntries.push(
          `- [CANON_INMUTABLE: ${resolved.formattedReference}]: "${resolved.text}"`
        );
      }
    }

    if (groundTruthEntries.length === 0) {
      return '';
    }

    return [
      '<SCRIPTURE_GROUND_TRUTH>',
      'REGLA INQUEBRANTABLE: Utiliza exclusivamente las siguientes citas textuales extraídas de SQLite.',
      'Está estrictamente prohibido citar versículos de memoria o alterar palabras.',
      ...groundTruthEntries,
      '</SCRIPTURE_GROUND_TRUTH>',
    ].join('\n');
  }
}
