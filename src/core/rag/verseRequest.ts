import { BibliaCoreService } from '../database/bibliaCoreService.js';
import { UserTheologicalLevel } from '../shield/types.js';
import { ScoredVerse } from './types.js';
import { THEOLOGICAL_THEMES } from './queryRewriter.js';

/**
 * Resolución de peticiones directas de versículo («dame un versículo sobre la paz»).
 *
 * El modelo lingüístico interpreta, explica y dialoga; la transcripción de la
 * Escritura se resuelve contra SQLite. Un modelo de bolsillo no debe recitar
 * texto bíblico de memoria: lo inventa con seguridad y sin aviso.
 */

export interface VerifiedVerse {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  version: string;
  topic: string;
}

const REQUEST_VERB =
  'dame|damel[oa]|mu[eé]strame|ens[eé][ñn]ame|comparte|busca|encuentra|recomi[eé]ndame|sugiere|quiero|necesito|ay[uú]dame a encontrar';

const VERSE_NOUN =
  'vers[ií]culo|vers[ií]culos|cita b[ií]blica|texto b[ií]blico|palabra b[ií]blica|promesa b[ií]blica|pasaje b[ií]blico';

const SIMPLE_VERSE_PATTERNS = [
  new RegExp(`\\b(?:${REQUEST_VERB})\\b[^.!?]{0,55}\\b(?:${VERSE_NOUN})\\b`, 'i'),
  new RegExp(`\\b(?:${VERSE_NOUN})\\b[^.!?]{0,35}\\b(?:corto|breve|sobre|acerca de|que hable|que trate)\\b`, 'i'),
  /\b(?:qu[eé] dice la biblia|qu[eé] ense[ñn]a la biblia)\b[^.!?]{0,30}\b(?:sobre|acerca de)\b/i,
];

/** Una petición de explicación merece el modelo, no un atajo de cita. */
const EXPLANATION_PATTERN =
  /\b(explica|expl[ií]came|expl[ií]calo|expl[ií]quen|interpreta|interpr[eé]tame|analiza|an[aá]lisis|ex[eé]gesis|contexto|qu[eé] significa|significado|profundiza|desarrolla|compara)\b/i;

const STOPWORDS = new Set([
  'dame',
  'damelo',
  'damela',
  'muestrame',
  'enseñame',
  'comparte',
  'busca',
  'encuentra',
  'recomiendame',
  'sugiere',
  'quiero',
  'necesito',
  'ayudame',
  'encontrar',
  'un',
  'una',
  'unos',
  'unas',
  'el',
  'la',
  'lo',
  'los',
  'las',
  'de',
  'del',
  'al',
  'que',
  'hable',
  'habla',
  'trate',
  'trata',
  'sobre',
  'acerca',
  'para',
  'por',
  'favor',
  'mi',
  'mis',
  'su',
  'sus',
  'corto',
  'corta',
  'breve',
  'pequeno',
  'pequena',
  'versiculo',
  'versiculos',
  'cita',
  'texto',
  'palabra',
  'promesa',
  'pasaje',
  'biblico',
  'biblica',
  'biblia',
  'sagrada',
  'sagrado',
  'dios',
  'senor',
  'cristo',
  'jesus',
  'dice',
  'dicen',
  'dijo',
  'menciona',
  'senala',
  'segun',
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSimpleVerseRequest(prompt: string): boolean {
  const text = prompt.trim();
  if (!text) return false;
  if (EXPLANATION_PATTERN.test(text)) return false;
  return SIMPLE_VERSE_PATTERNS.some((pattern) => pattern.test(text));
}

function extractTopicWords(prompt: string): string[] {
  const normalized = normalize(prompt);
  const words = normalized
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

  return Array.from(new Set(words));
}

function referenceOf(verse: { libro_nombre: string; capitulo: number; versiculo: number }): string {
  return `${verse.libro_nombre} ${verse.capitulo}:${verse.versiculo}`;
}

interface Candidate {
  verse: { libro_nombre: string; capitulo: number; versiculo: number; texto: string; version?: string };
  score: number;
  matched: Set<string>;
}

function scoreCandidate(
  text: string,
  topic: string,
  specificity: number
): number {
  const normalizedText = normalize(text);
  const index = normalizedText.indexOf(topic);
  // Cuanto antes aparece el tema y más corto es el versículo, mejor responde
  // a «dame un versículo corto sobre…».
  const positionPenalty = index >= 0 ? Math.min(30, index * 0.4) : 15;
  const lengthPenalty = Math.min(25, text.length / 12);
  return 100 - positionPenalty - lengthPenalty + specificity;
}

function collectDirectMatches(
  service: BibliaCoreService,
  words: string[]
): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();

  for (const word of words) {
    const results = service.searchVerses(word, 12);
    const specificity = Math.max(1, 24 / Math.max(1, results.length));

    for (const result of results) {
      const key = referenceOf(result);
      const existing = candidates.get(key);
      const score = scoreCandidate(result.texto, word, specificity);

      if (!existing) {
        candidates.set(key, {
          verse: {
            libro_nombre: result.libro_nombre,
            capitulo: result.capitulo,
            versiculo: result.versiculo,
            texto: result.texto,
            version: result.version,
          },
          score,
          matched: new Set([word]),
        });
        continue;
      }

      existing.matched.add(word);
      if (score > existing.score) existing.score = score;
    }
  }

  return candidates;
}

function fromScoredVerse(entry: ScoredVerse, topic: string): VerifiedVerse {
  const verse = entry.versiculo;
  return {
    book: verse.libro_nombre,
    chapter: verse.capitulo,
    verse: verse.versiculo,
    reference: referenceOf(verse),
    text: verse.texto,
    version: verse.version || 'RV1909',
    topic,
  };
}

function relatedThemeWords(words: string[]): string[] {
  const related = new Set<string>();

  for (const theme of THEOLOGICAL_THEMES) {
    const vocabulary = [...theme.conceptosClave, ...theme.terminosHumanos].map(normalize);
    const matched = words.some((word) =>
      vocabulary.some((term) => term === word || term.includes(word) || word.includes(term))
    );

    if (!matched) continue;
    theme.conceptosClave.forEach((concept) => related.add(normalize(concept)));
    theme.terminosHumanos.forEach((term) => related.add(normalize(term)));
  }

  return Array.from(related).filter(
    (word) => word.length >= 3 && !STOPWORDS.has(word) && !words.includes(word)
  );
}

function defaultVerse(level: UserTheologicalLevel): VerifiedVerse {
  return level === 'Semilla'
    ? {
        book: 'Salmos',
        chapter: 23,
        verse: 1,
        reference: 'Salmos 23:1',
        text: 'JEHOVA es mi pastor; nada me faltará.',
        version: 'RV1909',
        topic: '',
      }
    : {
        book: 'Romanos',
        chapter: 8,
        verse: 28,
        reference: 'Romanos 8:28',
        text:
          'Y sabemos que á los que á Dios aman, todas las cosas les ayudan á bien, es á saber, á los que conforme al propósito son llamados.',
        version: 'RV1909',
        topic: '',
      };
}

/**
 * Devuelve la mejor cita verificada para el tema pedido. Si no hay coincidencia
 * literal, usa el versículo que el RAG ya consideró más relevante.
 */
export function resolveVerifiedVerse(
  prompt: string,
  service: BibliaCoreService,
  fallbackVerses: ScoredVerse[] = [],
  level: UserTheologicalLevel = 'Semilla'
): VerifiedVerse | null {
  const words = extractTopicWords(prompt);
  const topic = words.join(' ');

  if (words.length > 0) {
    const direct = collectDirectMatches(service, words);
    // Si había varios términos, preferimos el versículo que cubre más de uno.
    const best = Array.from(direct.values()).sort(
      (a, b) => b.matched.size - a.matched.size || b.score - a.score
    )[0];

    if (best) {
      return {
        book: best.verse.libro_nombre,
        chapter: best.verse.capitulo,
        verse: best.verse.versiculo,
        reference: referenceOf(best.verse),
        text: best.verse.texto,
        version: best.verse.version || 'RV1909',
        topic,
      };
    }
  }

  const fallback = fallbackVerses.find((entry) => entry.puntaje >= 20) ?? fallbackVerses[0];
  if (fallback) {
    return fromScoredVerse(fallback, topic);
  }

  if (words.length > 0) {
    const related = collectDirectMatches(service, relatedThemeWords(words));
    const bestRelated = Array.from(related.values()).sort((a, b) => b.score - a.score)[0];
    if (bestRelated) {
      return {
        book: bestRelated.verse.libro_nombre,
        chapter: bestRelated.verse.capitulo,
        verse: bestRelated.verse.versiculo,
        reference: referenceOf(bestRelated.verse),
        text: bestRelated.verse.texto,
        version: bestRelated.verse.version || 'RV1909',
        topic,
      };
    }
  }

  // Sin tema (o sin coincidencias) devolvemos un ancla conocida sólo cuando la
  // petición era explícitamente un versículo; el llamador decide si la usa.
  return isSimpleVerseRequest(prompt) ? defaultVerse(level) : null;
}
