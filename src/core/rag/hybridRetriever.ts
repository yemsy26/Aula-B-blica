import { BibliaCoreService } from '../database/bibliaCoreService.js';
import { VerseSeed, StrongSeed } from '../database/seedData.js';
import { UserTheologicalLevel } from '../shield/types.js';
import { SemanticRewriteResult, ScoredVerse } from './types.js';
import { THEOLOGICAL_THEMES } from './queryRewriter.js';
import { extractBiblicalReference } from '../inference/passageExegesisService.js';

export class HybridRetriever {
  private bibliaService: BibliaCoreService;

  constructor(bibliaService: BibliaCoreService) {
    this.bibliaService = bibliaService;
  }

  /**
   * Ejecuta búsqueda híbrida: Léxica (FTS/LIKE) + Semántica por conceptos + Expansión TSK y Strong
   */
  retrieve(
    rewrite: SemanticRewriteResult,
    userLevel: UserTheologicalLevel = 'Semilla',
    maxResults: number = 5
  ): ScoredVerse[] {
    const candidateMap = new Map<string, { verse: VerseSeed; lexical: number; semantic: number }>();

    // Helper para clave de mapa
    const getVerseKey = (v: VerseSeed) => `${v.libro_nombre}_${v.capitulo}_${v.versiculo}`;

    // 0. Detección directa de pasajes o versículos específicos (ej: Salmos 23:1, Juan 3:16)
    const exactRef =
      extractBiblicalReference(rewrite.queryOriginal) ||
      extractBiblicalReference(rewrite.queryNormalizada);
    if (exactRef && exactRef.verseStart) {
      if (exactRef.verseEnd && exactRef.verseEnd > exactRef.verseStart) {
        const rangeVerses = this.bibliaService.getVerseRange(
          exactRef.bookName,
          exactRef.chapter,
          exactRef.verseStart,
          exactRef.verseEnd
        );
        for (const v of rangeVerses) {
          const key = getVerseKey(v);
          const existing = candidateMap.get(key) || { verse: v, lexical: 0, semantic: 0 };
          existing.lexical += 150;
          existing.semantic += 150;
          candidateMap.set(key, existing);
        }
      } else {
        const directVerse = this.bibliaService.getVerse(
          exactRef.bookName,
          exactRef.chapter,
          exactRef.verseStart
        );
        if (directVerse) {
          const key = getVerseKey(directVerse);
          const existing = candidateMap.get(key) || { verse: directVerse, lexical: 0, semantic: 0 };
          existing.lexical += 200;
          existing.semantic += 200;
          candidateMap.set(key, existing);
        }
      }
    } else if (exactRef && !exactRef.verseStart) {
      // Capítulo completo mencionado (ej: Salmo 23, Romanos 8)
      const chapterVerses = this.bibliaService
        .getVersesByBook(exactRef.bookName, 12)
        .filter((v) => v.capitulo === exactRef.chapter);
      for (const v of chapterVerses) {
        const key = getVerseKey(v);
        const existing = candidateMap.get(key) || { verse: v, lexical: 0, semantic: 0 };
        existing.lexical += 120;
        existing.semantic += 120;
        candidateMap.set(key, existing);
      }
    }

    // 1. Recuperación léxica vía FTS / Concordancia en SQLite
    for (const term of rewrite.terminosBusqueda) {
      if (term.length < 3) continue;
      const ftsMatches = this.bibliaService.searchVerses(term, 8);
      for (const match of ftsMatches) {
        const vSeed: VerseSeed = {
          libro_id: 1, // Metadata básica
          libro_nombre: match.libro_nombre,
          capitulo: match.capitulo,
          versiculo: match.versiculo,
          texto: match.texto,
          version: match.version,
        };
        const key = getVerseKey(vSeed);
        const existing = candidateMap.get(key) || { verse: vSeed, lexical: 0, semantic: 0 };
        existing.lexical += 25; // Acumular peso léxico
        candidateMap.set(key, existing);
      }
    }

    // 2. Recuperación semántica por temas mapeados
    for (const themeName of rewrite.temasDetectados) {
      const theme = THEOLOGICAL_THEMES.find((t) => t.nombre === themeName);
      if (!theme) continue;

      for (const target of theme.versiculosClave) {
        const directVerse = this.bibliaService.getVerse(
          target.libro,
          target.capitulo,
          target.versiculo
        );
        if (directVerse) {
          const key = getVerseKey(directVerse);
          const existing = candidateMap.get(key) || { verse: directVerse, lexical: 0, semantic: 0 };
          existing.semantic += 50; // Fuerte correlación semántica
          candidateMap.set(key, existing);
        }
      }
    }

    // 3. Recuperación directa de libros sugeridos (ej: Mateo, Romanos, Génesis)
    if (rewrite.librosSugeridos.length > 0) {
      for (const book of rewrite.librosSugeridos) {
        const bookVerses = this.bibliaService.getVersesByBook(book, 6);
        for (const v of bookVerses) {
          const key = getVerseKey(v);
          const existing = candidateMap.get(key) || { verse: v, lexical: 0, semantic: 0 };
          existing.semantic += 75; // Alta relevancia por mención explícita
          candidateMap.set(key, existing);
        }
      }
    }

    // Si aún hay pocos candidatos, buscar en los libros sugeridos
    if (candidateMap.size === 0 && rewrite.librosSugeridos.length > 0) {
      for (const book of rewrite.librosSugeridos.slice(0, 2)) {
        const fallback = this.bibliaService.getVerseRange(book, 1, 1, 3);
        for (const v of fallback) {
          const key = getVerseKey(v);
          candidateMap.set(key, { verse: v, lexical: 5, semantic: 15 });
        }
      }
    }

    // 4. Puntuación ponderada y expansión canónica (TSK + Strong)
    const scoredList: ScoredVerse[] = [];

    for (const [, item] of candidateMap.entries()) {
      const { verse, lexical, semantic } = item;

      // Expansión TSK (Referencias Cruzadas)
      const tskRefs = this.bibliaService.getCrossReferences(
        verse.libro_nombre,
        verse.capitulo,
        verse.versiculo
      );
      const relevanciaTsk = Math.min(tskRefs.length * 10, 30);

      // Ponderación por Nivel de Usuario y libro sugerido
      let pesoNivel = 10;
      if (userLevel === 'Maestro') {
        pesoNivel = tskRefs.length > 0 ? 25 : 10;
      } else if (userLevel === 'Semilla') {
        pesoNivel = ['Salmos', 'Juan', 'Mateo'].includes(verse.libro_nombre) ? 20 : 10;
      }

      const bonusLibro = rewrite.librosSugeridos.includes(verse.libro_nombre) ? 35 : 0;

      // Cálculo del puntaje final normalizado (0 a 100)
      const totalScore = Math.min(
        Math.round(lexical * 0.35 + semantic * 0.45 + relevanciaTsk * 0.1 + pesoNivel * 0.1 + bonusLibro),
        100
      );

      // Expansión Strong si el nivel es Maestro o si hay códigos sugeridos
      const strongList: StrongSeed[] = [];
      if (userLevel === 'Maestro' || rewrite.codigosStrongSugeridos.length > 0) {
        for (const code of rewrite.codigosStrongSugeridos) {
          const entry = this.bibliaService.getStrongEntry(code);
          if (entry) strongList.push(entry);
        }
      }

      scoredList.push({
        versiculo: verse,
        puntaje: totalScore,
        fuentesPuntaje: {
          lexicoFts: lexical,
          semanticoTema: semantic,
          relevanciaTsk,
          pesoNivel,
        },
        referenciasCruzadas: tskRefs,
        strongData: strongList.length > 0 ? strongList : undefined,
      });
    }

    // Ordenar descendente por puntaje y recortar al presupuesto de resultados
    scoredList.sort((a, b) => b.puntaje - a.puntaje);
    return scoredList.slice(0, maxResults);
  }
}
