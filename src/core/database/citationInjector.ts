import { BibliaCoreService } from './bibliaCoreService.js';
import { normalizeLinguisticDialect } from '../shield/normalizer.js';

// Regex que detecta tags explícitos: [CITA: Juan 3:16], [CITA: Génesis 1:1-3], [CITA: Salmos 23:1], [CITA: Salmos 23]
const CITA_TAG_REGEX = /\[CITA:\s*([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?\]/gi;

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
 * Respaldo Canónico Inmutable RV1909 para Pasajes Clave y Conexiones Intertextuales
 */
const CANONICAL_FALLBACK_VERSES: Record<string, string> = {
  'Juan 10:11': 'Yo soy el buen pastor: el buen pastor su vida da por las ovejas.',
  'Juan 10:14': 'Yo soy el buen pastor; y conozco mis ovejas, y las mías me conocen,',
  'Juan 10:27': 'Mis ovejas oyen mi voz, y yo las conozco, y me siguen;',
  'Juan 10:28': 'Y yo les doy vida eterna y no perecerán para siempre, ni nadie las arrebatará de mi mano.',
  'Salmos 23:1': 'JEHOVA es mi pastor; nada me faltará.',
  'Salmos 23:2': 'En lugares de delicados pastos me hará yacer: Junto á aguas de reposo me pastoreará.',
  'Salmos 23:3': 'Confortará mi alma; Guiárame por sendas de justicia por amor de su nombre.',
  'Salmos 23:4': 'Aunque ande en valle de sombra de muerte, No temeré mal alguno; porque tú estarás conmigo: Tu vara y tu cayado me infundirán aliento.',
  'Salmos 23:5': 'Aderezarás mesa delante de mí en presencia de mis angustiadores: Ungiste mi cabeza con aceite; mi copa está rebosando.',
  'Salmos 23:6': 'Ciertamente el bien y la misericordia me seguirán todos los días de mi vida: Y en la casa de Jehová moraré por largos días.',
  'Romanos 5:8': 'Mas Dios encarece su caridad para con nosotros, porque siendo aún pecadores, Cristo murió por nosotros.',
  'Romanos 8:1': 'AHORA pues, ninguna condenación hay para los que están en Cristo Jesús, los que no andan conforme á la carne, mas conforme al espíritu.',
  'Romanos 8:28': 'Y sabemos que á los que á Dios aman, todas las cosas les ayudan á bien, es á saber, á los que conforme al propósito son llamados.',
  'Romanos 8:31': '¿Pues qué diremos á esto? Si Dios por nosotros, ¿quién contra nosotros?',
  'Romanos 8:38': 'Por lo cual estoy cierto que ni la muerte, ni la vida, ni ángeles, ni principados, ni potestades, ni lo presente, ni lo por venir,',
  'Romanos 8:39': 'Ni lo alto, ni lo bajo, ni ninguna criatura nos podrá apartar del amor de Dios, que es en Cristo Jesús Señor nuestro.',
  'Romanos 3:24': 'Siendo justificados gratuitamente por su gracia por la redención que es en Cristo Jesús;',
  'Romanos 4:3': 'Porque ¿qué dice la Escritura? Y creyó Abraham á Dios, y le fué atribuído á justicia.',
  'Génesis 1:1': 'EN el principio crió Dios los cielos y la tierra.',
  'Génesis 50:20': 'Vosotros pensasteis mal sobre mí, mas Dios lo encaminó á bien, para hacer lo que vemos hoy, para mantener en vida á mucho pueblo.',
  '2 Corintios 12:9': 'Y me ha dicho: Bástate mi gracia; porque mi potencia en la flaqueza se perfecciona. Por tanto, de buena gana me gloriaré más bien en mis flaquezas, porque habite en mí la potencia de Cristo.',
  'Filipenses 4:13': 'Todo lo puedo en Cristo que me fortalece.',
  'Filipenses 4:19': 'Mi Dios, pues, suplirá todo lo que os falta conforme á sus riquezas en gloria en Cristo Jesús.',
  'Salmos 119:105': 'LÁMPARA es á mis pies tu palabra, Y lumbrera á mi camino.',
  'Hebreos 2:14': 'Así que, por cuanto los hijos participaron de carne y sangre, él también participó juntamente de lo mismo, para destruir por la muerte al que tenía el imperio de la muerte, es á saber, al diablo,',
  'Hebreos 13:20': 'Y el Dios de paz que sacó de los muertos á nuestro Señor Jesucristo, el gran pastor de las ovejas, por la sangre del testamento eterno,',
  '1 Juan 4:9': 'En esto se mostró el amor de Dios para con nosotros, en que Dios envió á su Hijo unigénito al mundo, para que vivamos por él.',
  '1 Pedro 2:24': 'El cual mismo llevó nuestros pecados en su cuerpo sobre el madero, para que nosotros siendo muertos á los pecados, vivamos á la justicia: por la herida del cual habéis sido sanados.',
  '1 Pedro 2:25': 'Porque vosotros erais como ovejas descarriadas; mas ahora habéis vuelto al Pastor y Obispo de vuestras almas.',
};

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
   * Resuelve e inyecta un solo versículo, rango de versículos o capítulo completo
   */
  resolveVerseOrRange(
    rawBook: string,
    chapter: number,
    startVerse?: number,
    endVerse?: number,
    version: string = 'RV1909'
  ): { text: string; found: boolean; formattedReference: string } {
    // Normalizar abreviaturas como "Jn" -> "Juan", "1co" -> "1 Corintios"
    const normalizedBook = normalizeLinguisticDialect(rawBook.trim());

    // Caso A: Rango explícito de versículos (ej: Salmos 23:1-6)
    if (startVerse !== undefined && endVerse !== undefined && endVerse > startVerse) {
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

      // Fallback a CANONICAL_FALLBACK_VERSES para rango
      const fallbackRange: string[] = [];
      for (let v = startVerse; v <= endVerse; v++) {
        const fb = CANONICAL_FALLBACK_VERSES[`${normalizedBook} ${chapter}:${v}`];
        if (fb) {
          fallbackRange.push(`(${v}) ${fb}`);
        }
      }
      if (fallbackRange.length > 0) {
        return {
          text: fallbackRange.join(' '),
          found: true,
          formattedReference: `${normalizedBook} ${chapter}:${startVerse}-${endVerse} (RV1909)`,
        };
      }
    } else if (startVerse !== undefined) {
      // Caso B: Versículo único (ej: Salmos 23:1)
      const single = this.bibliaService.getVerse(normalizedBook, chapter, startVerse, version);
      if (single) {
        return {
          text: single.texto,
          found: true,
          formattedReference: `${single.libro_nombre} ${chapter}:${startVerse} (${version})`,
        };
      }

      // Fallback de alta fidelidad para pasajes clave y citas de conexión canónica
      const singleFallback = CANONICAL_FALLBACK_VERSES[`${normalizedBook} ${chapter}:${startVerse}`];
      if (singleFallback) {
        return {
          text: singleFallback,
          found: true,
          formattedReference: `${normalizedBook} ${chapter}:${startVerse} (RV1909)`,
        };
      }
    } else {
      // Caso C: Capítulo completo (ej: Salmos 23)
      const verses = this.bibliaService.getVersesByChapter(normalizedBook, chapter, version);
      if (verses.length > 0) {
        const text = verses.map((v) => `(${v.versiculo}) ${v.texto}`).join(' ');
        const lastV = verses[verses.length - 1].versiculo;
        return {
          text,
          found: true,
          formattedReference: `${verses[0].libro_nombre} ${chapter}:1-${lastV} (${version})`,
        };
      }

      // Fallback a CANONICAL_FALLBACK_VERSES para capítulo completo
      const fallbackRange: string[] = [];
      let v = 1;
      while (CANONICAL_FALLBACK_VERSES[`${normalizedBook} ${chapter}:${v}`]) {
        fallbackRange.push(`(${v}) ${CANONICAL_FALLBACK_VERSES[`${normalizedBook} ${chapter}:${v}`]}`);
        v++;
      }
      if (fallbackRange.length > 0) {
        return {
          text: fallbackRange.join(' '),
          found: true,
          formattedReference: `${normalizedBook} ${chapter}:1-${v - 1} (RV1909)`,
        };
      }
    }

    return {
      text: '',
      found: false,
      formattedReference: `${normalizedBook} ${chapter}${startVerse ? `:${startVerse}${endVerse ? `-${endVerse}` : ''}` : ''}`,
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
        const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : undefined;
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
          startVerse: startVerse || 1,
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
