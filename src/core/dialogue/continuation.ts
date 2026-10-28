import { ChatMessage } from '../database/usuarioMemoriaService.js';

/**
 * «Continúa» dicho a secas no es una consulta nueva: es una orden para retomar
 * la respuesta anterior exactamente donde se cortó.
 *
 * El caso que motivó este módulo: el usuario cambió del 1.5B al 3B y escribió
 * «continuar»; el modelo nuevo no sabía qué continuar y saludaba. Con este
 * detector el turno se resuelve contra el último par usuario/asistente del
 * historial, sin depender de que el cerebro recuerde nada por su cuenta.
 */

const CONTINUATION_PHRASES = new Set([
  'continua',
  'continuar',
  'continua por favor',
  'continua ya',
  'continua pues',
  'continuar por favor',
  'sigue',
  'sigues',
  'sigue por favor',
  'sigue ya',
  'prosigue',
  'proseguir',
  'prosigue por favor',
  'adelante',
  'dale',
  'dale ya',
  'termina',
  'terminala',
  'termina la respuesta',
  'completa',
  'completala',
  'completa la respuesta',
  'continua la respuesta',
  'continua la explicacion',
  'sigue la respuesta',
  'no te detengas',
  'no pares',
  'sigue adelante',
  'continua donde quedaste',
  'continua donde te quedaste',
  'continua desde donde quedaste',
  'continua desde donde te quedaste',
  'sigue donde quedaste',
  'sigue desde donde quedaste',
  'lo que sigue',
  'el resto',
  'termina el documento',
  'completa el documento',
  'continua el documento',
  'puedes continuar',
  'puedes seguir',
  'puedes terminar',
  'puedes completar',
  'podrias continuar',
  'podrias seguir',
  'podrias terminar',
  'podrias completar',
  'me puedes continuar',
  'me puedes seguir',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¡!¿?.,;:…"'«»()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Solo acepta frases que *son* una orden de continuar. Una petición nueva que
 * empiece igual («continúa el estudio de Juan 3 para jóvenes») debe seguir su
 * curso normal, no retomar la respuesta anterior.
 */
export function isContinuationRequest(text: string): boolean {
  const normalized = normalize(text);
  if (normalized.length === 0 || normalized.length > 90) return false;

  if (CONTINUATION_PHRASES.has(normalized)) return true;

  const stripped = normalized
    .replace(/^(por favor|oye|hermano|amigo)\s+/, '')
    .replace(/\s+(por favor|ya|pues)$/, '')
    .trim();

  return stripped !== normalized && CONTINUATION_PHRASES.has(stripped);
}

/** Quita avisos del sistema que no forman parte de la respuesta redactada. */
export function stripContinuationNoise(text: string): string {
  return text
    .replace(/\n*>\s*\*\*Nota del cerebro local:\*\*[^\n]*/gi, '')
    .replace(/\n*>\s*\*\*Nota:\*\*[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Solo el aviso de límite del cerebro local. Se usa al empalmar una
 * continuación: el aviso dejó de ser cierto en cuanto la respuesta siguió.
 */
export function stripLocalLimitNote(text: string): string {
  return text
    .replace(/\n*>\s*\*\*Nota del cerebro local:\*\*[^\n]*/gi, '')
    // Aviso de una continuación que no produjo texto nuevo; no debe acumularse.
    .replace(/\n*>\s*\*\*Nota:\*\* el modelo no añadió texto nuevo[^\n]*/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

export interface ContinuationContext {
  /** Petición que originó la respuesta que se va a retomar. */
  previousUser: string;
  /** Última respuesta del asistente, ya sin avisos del sistema. */
  previousAssistant: string;
  /** Tramo final de esa respuesta: lo que el modelo necesita para empalmar. */
  assistantTail: string;
  /** Id del mensaje del asistente que la interfaz debe ampliar. */
  previousAssistantId?: string;
}

function tailOf(text: string, max: number): string {
  const value = text.trim();
  if (value.length <= max) return value;

  const slice = value.slice(-max);
  const firstBoundary = slice.search(/[\s\n]/);
  const clean = firstBoundary >= 0 ? slice.slice(firstBoundary + 1) : slice;
  return `…${clean.trimStart()}`;
}

/**
 * Recupera el último intercambio completo. El historial incluye el turno actual
 * («continúa») al final, por eso se busca el último asistente y, antes de él,
 * la última petición real del usuario.
 */
export function extractContinuationContext(
  history: ChatMessage[] | undefined,
  options: { tailChars?: number } = {}
): ContinuationContext | null {
  if (!history || history.length === 0) return null;

  let assistantIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'assistant') {
      assistantIndex = index;
      break;
    }
  }
  if (assistantIndex < 0) return null;

  const assistant = history[assistantIndex];
  const previousAssistant = stripContinuationNoise(assistant.content ?? '');
  if (previousAssistant.length === 0) return null;

  let previousUser = '';
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const candidate = history[index];
    if (candidate.role !== 'user') continue;
    const content = (candidate.content ?? '').trim();
    if (content.length === 0 || isContinuationRequest(content)) continue;
    previousUser = content;
    break;
  }

  return {
    previousUser,
    previousAssistant,
    assistantTail: tailOf(previousAssistant, options.tailChars ?? 1200),
    previousAssistantId: assistant.id,
  };
}

/**
 * Une una continuación con la respuesta previa sin duplicar el solape que a
 * veces devuelve el modelo (repite la última frase antes de seguir).
 */
export function mergeContinuationText(previous: string, addition: string): string {
  const base = previous.trimEnd();
  const next = addition.trim();
  if (next.length === 0) return base;
  if (base.length === 0) return next;

  const maxOverlap = Math.min(320, base.length, next.length);
  for (let size = maxOverlap; size >= 32; size -= 1) {
    if (base.slice(-size) === next.slice(0, size)) {
      return `${base}${next.slice(size)}`;
    }
  }

  // Solape parcial por palabras: el modelo repitió las últimas 6–20 palabras.
  const baseWords = base.split(/\s+/);
  const nextWords = next.split(/\s+/);
  const maxWords = Math.min(24, baseWords.length, nextWords.length);
  for (let size = maxWords; size >= 6; size -= 1) {
    const left = baseWords.slice(-size).join(' ');
    const right = nextWords.slice(0, size).join(' ');
    if (left === right) {
      return `${base}\n\n${nextWords.slice(size).join(' ')}`.trimEnd();
    }
  }

  // El 3B puede reescribir la respuesta completa al retomar en vez de seguirla.
  // Se compara por párrafos normalizados: si el comienzo de la continuación ya
  // está al final de lo escrito, ese bloque no se añade.
  const normalizeParagraph = (paragraph: string) =>
    paragraph.toLowerCase().replace(/\s+/g, ' ').trim();
  const baseParagraphs = base.split(/\n{2,}/).map((paragraph) => paragraph.trim());
  const nextParagraphs = next.split(/\n{2,}/).map((paragraph) => paragraph.trim());
  const baseNormalized = baseParagraphs.map(normalizeParagraph);
  const nextNormalized = nextParagraphs.map(normalizeParagraph);
  const maxParagraphs = Math.min(baseNormalized.length, nextNormalized.length);
  for (let size = maxParagraphs; size >= 1; size -= 1) {
    const baseTail = baseNormalized.slice(-size);
    const nextHead = nextNormalized.slice(0, size);
    const isRepeat =
      nextHead.every((paragraph, index) => paragraph.length > 0 && paragraph === baseTail[index]) &&
      nextHead.join(' ').length >= 40;
    if (!isRepeat) continue;

    const rest = nextParagraphs.slice(size).join('\n\n');
    return rest.length > 0 ? `${base}\n\n${rest}` : base;
  }

  const separator = base.endsWith('\n') ? '' : '\n\n';
  return `${base}${separator}${next}`;
}
