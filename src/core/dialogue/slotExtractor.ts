import { findCanonicalBook } from '../database/canonicalBooks.js';
import { extractBiblicalReference } from '../inference/passageExegesisService.js';
import { findBiblicalMirror } from '../rag/casuistryMapper.js';
import { MinistryFormat } from '../shield/types.js';
import {
  DetectedTurnContext,
  DialogueAudience,
  DialogueSlots,
  DialogueTask,
  DialogueTone,
  FollowUpKind,
  PassageRef,
} from './types.js';
import { matchCharacterEntry, matchDoctrineEntry } from './theologyCatalog.js';

export interface ExtractTurnOptions {
  preferredFormat?: MinistryFormat;
  previousPassage?: PassageRef;
  previousTopic?: string;
}

const DOCUMENT_NOUN_PATTERN =
  '(serm[oó]n|predicaci[oó]n|pr[eé]dica|bosquejo|clase|lecci[oó]n|gu[ií]a|devocional|campa[ñn]a|serie|liturgia|ceremonia|taller|discipulado|hoja de estudio)';

const REQUEST_VERB_PATTERN =
  '(prepara|prep[aá]rame|preparme|hazme|haz|arma|a?[aá]rmame|elabora|elab[oó]rame|redacta|red[aá]ctame|escribe|escr[ií]beme|genera|gen[eé]rame|crea|crc[eé]ame|dise[ñn]a|comp[oó]n|necesito|quiero|dame|me gustar[ií]a|puedes hacer|podr[ií]as hacer|ay[uú]dame a (?:preparar|hacer|crear|redactar))';

const DOCUMENT_REQUEST_REGEX = new RegExp(
  `${REQUEST_VERB_PATTERN}[^.!?]{0,50}${DOCUMENT_NOUN_PATTERN}|${DOCUMENT_NOUN_PATTERN}[^.!?]{0,40}(?:sobre|acerca de|para|de)\\s+\\S`,
  'i'
);

const EXPLICIT_GENERATION_REGEX =
  /\b(hazlo ya|hazlo ahora|genera(?:lo)?(?: ya| ahora)?|genera el documento|escr[ií]belo|red[aá]ctalo|procede|adelante|dale|de una vez|sin preguntas|no me preguntes|conf[ií]rmalo|aprobado|est[aá] bien,? hazlo|s[ií],? hazlo|directo al documento)\b/i;

const OVERRIDE_REGEX =
  /\b(sin preguntas|no me preguntes|solo dime|s[oó]lo dime|al grano|sin rodeos|directo|no des vueltas|ve al punto|sin tanta explicaci[oó]n)\b/i;

/** Respuestas que aprueban una propuesta y no aportan un tema nuevo. */
const APPROVAL_ONLY_REGEX =
  /^(s[ií]|claro|ok|okay|dale|adelante|perfecto|de acuerdo|est[aá] bien|hazlo|hazlo ya|hazlo ahora|procede|conf[ií]rmo|confirmado|aprobado|me gusta|suena bien|genera|gen[eé]ralo|genera el documento|escr[ií]belo|red[aá]ctalo|directo al documento)[\s.!]*$/i;

/** Palabras de ocasión o calendario que no constituyen un tema teológico. */
const OCCASION_ONLY_REGEX =
  /^(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|hoy|ma[ñn]ana|pasado ma[ñn]ana|esta semana|la pr[oó]xima semana|el pr[oó]ximo domingo|este domingo|el domingo|culto|servicio|reuni[oó]n|encuentro|evento|vigilia|celebraci[oó]n)$/i;

const GREETING_REGEX =
  /^(hola|hola!|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|saludos|qu[eé] tal|c[oó]mo est[aá]s|como estas|qui[eé]n eres|qu[eé] puedes hacer|en qu[eé] me puedes ayudar|ayuda)\b[\s,!.]*$/i;

const AUDIENCE_MAP: { audience: DialogueAudience; pattern: RegExp }[] = [
  { audience: 'ninos', pattern: /\b(ni[ñn]os?|infantil|preescolar|primaria)\b/i },
  { audience: 'jovenes', pattern: /\b(j[oó]venes?|adolescentes?|juventud|universitarios?)\b/i },
  { audience: 'lideres', pattern: /\b(l[ií]deres?|ancianos?|di[aá]conos?|pastores?|maestros?)\b/i },
  { audience: 'matrimonios', pattern: /\b(matrimonios?|esposos?|parejas?)\b/i },
  { audience: 'mujeres', pattern: /\b(mujeres|hermanas|femenil)\b/i },
  { audience: 'hombres', pattern: /\b(hombres|varones|masculin[oa])\b/i },
  { audience: 'congregacion', pattern: /\b(congregaci[oó]n|iglesia|asamblea|p[uú]blico general)\b/i },
  { audience: 'personal', pattern: /\b(personal|para m[ií]|devocional personal|intimidad)\b/i },
  { audience: 'adultos', pattern: /\b(adultos?|mayores)\b/i },
];

const TASK_PATTERNS: { task: DialogueTask; pattern: RegExp }[] = [
  {
    task: 'ceremonia',
    pattern: /\b(boda|matrimonio|funeral|sepelio|liturgia|ceremonia|dedicaci[oó]n|presentaci[oó]n de ni[ñn]o)\b/i,
  },
  {
    task: 'predicar',
    pattern: /\b(predicar|predica|pr[eé]dica|serm[oó]n|p[uú]lpito|culto|exposici[oó]n b[ií]blica|homil[ií]a)\b/i,
  },
  {
    task: 'ensenar',
    pattern: /\b(ense[ñn]ar|clase|escuela dominical|lecci[oó]n|catequesis|discipular|taller)\b/i,
  },
  {
    task: 'orar',
    pattern: /\b(ora por|oraci[oó]n por|haz una oraci[oó]n|gu[ií]ame en oraci[oó]n|intercede)\b/i,
  },
  {
    task: 'doctrinar',
    pattern:
      /\b(doctrina|teolog[ií]a sistem[aá]tica|apolog[eé]tica|herej[ií]a|trinidad|cristolog[ií]a|soteriolog[ií]a|escatolog[ií]a|pneumatolog[ií]a)\b/i,
  },
  {
    task: 'aconsejar',
    pattern:
      /\b(aconseja|aconsejame|aconsej[aá]me|consejo|consejer[ií]a|qu[eé] hago|me siento|estoy pasando|estoy sufriendo|ay[uú]dame a entender lo que siento|necesito hablar)\b/i,
  },
  {
    task: 'estudiar',
    pattern: /\b(estudiar|estudio|ex[eé]gesis|exeg[eé]tico|analiza|an[aá]lisis|profundiza|investiga)\b/i,
  },
];

const TONE_PATTERNS: { tone: DialogueTone; pattern: RegExp }[] = [
  {
    tone: 'academico',
    pattern: /\b(acad[eé]mic[oa]|exeg[eé]tic[oa]|hebreo|griego|t[eé]cnic[oa]|teol[oó]gic[oa] profunda)\b/i,
  },
  {
    tone: 'didactico',
    pattern: /\b(did[aá]ctic[oa]|sencill[oa]|f[aá]cil de entender|para ni[ñn]os|con ejemplos|paso a paso)\b/i,
  },
  {
    tone: 'solemne',
    pattern: /\b(solemne|reverente|lit[uú]rgic[oa]|f[uú]nebre|ceremonial)\b/i,
  },
  {
    tone: 'pastoral',
    pattern: /\b(pastoral|consolador|tierno|cercano|esperanzador)\b/i,
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectAudience(text: string): DialogueAudience | undefined {
  for (const entry of AUDIENCE_MAP) {
    if (entry.pattern.test(text)) return entry.audience;
  }
  return undefined;
}

function detectTask(text: string): DialogueTask {
  for (const entry of TASK_PATTERNS) {
    if (entry.pattern.test(text)) return entry.task;
  }
  return 'responder';
}

function detectTone(text: string): DialogueTone | undefined {
  for (const entry of TONE_PATTERNS) {
    if (entry.pattern.test(text)) return entry.tone;
  }
  return undefined;
}

function detectDurationMinutes(text: string): number | undefined {
  const hours = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:horas?|hrs?)\b/i);
  if (hours) return Math.round(parseFloat(hours[1].replace(',', '.')) * 60);

  const halfHour = /media hora/i.test(text);
  if (halfHour) return 30;

  const minutes = text.match(/\b(\d{1,3})\s*(?:minutos?|mins?)\b/i);
  if (minutes) return parseInt(minutes[1], 10);

  return undefined;
}

function detectDepth(text: string): DialogueSlots['depth'] | undefined {
  if (/\b(m[aá]s corto|breve|resumido|r[aá]pido|s[ií]ntesis|en pocas palabras)\b/i.test(text)) {
    return 'breve';
  }
  if (/\b(m[aá]s largo|extenso|detallado|profundo|a fondo|completo|exhaustivo)\b/i.test(text)) {
    return 'profundo';
  }
  if (/\b(normal|equilibrado|est[aá]ndar)\b/i.test(text)) {
    return 'normal';
  }
  return undefined;
}

function detectFormat(text: string, preferredFormat?: MinistryFormat): MinistryFormat | undefined {
  if (preferredFormat && preferredFormat !== 'AUTO') return preferredFormat;

  if (/\b(boda|funeral|sepelio|liturgia|ceremonia|dedicaci[oó]n)\b/i.test(text)) return 'CEREMONIA_ESPECIAL';
  if (/\b(campa[ñn]a|serie de|4 semanas|cuatro semanas|mes de|plan mensual)\b/i.test(text)) return 'SERIE_CAMPANA';
  if (/\b(escuela dominical|clase|lecci[oó]n|taller|catequesis)\b/i.test(text)) return 'ESTUDIO_CLASE';
  if (/\b(c[eé]lula|grupo peque[ñn]o|grupo de j[oó]venes)\b/i.test(text)) return 'CELULA_JOVENES';
  if (/\b(biograf[ií]a|perfil|personaje|vida de)\b/i.test(text)) return 'PERFIL_PERSONAJE';
  if (/\b(doctrina sistem[aá]tica|apolog[eé]tica|herej[ií]a|teolog[ií]a sistem[aá]tica)\b/i.test(text)) {
    return 'DOCTRINA_SISTEMATICA';
  }
  if (/\b(serm[oó]n|predicaci[oó]n|pr[eé]dica|p[uú]lpito|culto|predicar|homil[ií]a)\b/i.test(text)) {
    return 'SERMON_CULTO';
  }
  return undefined;
}

function detectFollowUp(
  text: string,
  options: { suppressAudienceChange?: boolean } = {}
): { kind: FollowUpKind; verse?: number; chapter?: number; book?: string } | undefined {
  const verse = text.match(/(?:^|\by\s+)?(?:el\s+)?vers[ií]culo\s+(\d{1,3})\b/i);
  if (verse) return { kind: 'next_verse', verse: parseInt(verse[1], 10) };

  const shortVerse = text.match(/^\s*y?\s*(?:el|al)\s+(\d{1,3})\s*[?.!]*$/i);
  if (shortVerse) return { kind: 'next_verse', verse: parseInt(shortVerse[1], 10) };

  const chapter = text.match(/\b(?:y\s+)?(?:el\s+)?cap[ií]tulo\s+(\d{1,3})\b/i);
  if (chapter) return { kind: 'chapter_change', chapter: parseInt(chapter[1], 10) };

  // «para jóvenes» dentro de una petición nueva («prepara un sermón ... para
  // jóvenes») describe la audiencia del documento, no un ajuste sobre uno previo.
  if (
    !options.suppressAudienceChange &&
    /\b(para|dirigido a|enfocado en)\s+(ni[ñn]os|j[oó]venes|adolescentes|adultos|l[ií]deres|congregaci[oó]n|mujeres|hombres|matrimonios|parejas)\b/i.test(text)
  ) {
    return { kind: 'audience_change' };
  }

  if (/\b(c[aá]mbialo|cambia|convi[eé]rtelo|p[aá]salo)\b[^.!?]{0,25}\b(a|en)\b[^.!?]{0,25}\b(clase|escuela dominical|serm[oó]n|c[eé]lula|campa[ñn]a|liturgia|serie|devocional)\b/i.test(text)) {
    return { kind: 'format_change' };
  }

  if (/\b(m[aá]s corto|m[aá]s breve|res[uú]melo|ac[oó]rtalo)\b/i.test(text)) {
    return { kind: 'length_change' };
  }

  if (/\b(m[aá]s profundo|profundiza|ampl[ií]a|desarrolla)\b/i.test(text)) {
    return { kind: 'depth_change' };
  }

  if (/\b(m[aá]s detalle|dame m[aá]s|expl[ií]calo mejor|cu[eé]ntame m[aá]s)\b/i.test(text)) {
    return { kind: 'more_detail' };
  }

  return undefined;
}

function isGreetingOnly(text: string): boolean {
  const normalized = normalize(text);
  if (normalized.length > 90) return false;
  if (GREETING_REGEX.test(normalized)) return true;

  const compact = normalized.replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)( como estas| que tal| hermano| hermano en cristo)?$/.test(
    compact
  );
}

function isQuestion(text: string): boolean {
  if (text.includes('?')) return true;
  return /^\s*(qu[eé]|qui[eé]n|qui[eé]nes|c[oó]mo|cu[aá]l|cu[aá]les|cu[aá]ndo|d[oó]nde|por qu[eé]|para qu[eé]|expl[ií]came|explica|h[aá]blame|cu[eé]ntame|dime)\b/i.test(
    text
  );
}

function isDocumentRequest(text: string, format: MinistryFormat | undefined): boolean {
  const normalized = normalize(text);
  const startsAsDefinitionQuestion =
    /^(que es|que significa|como se prepara|como se hace|para que sirve)\b/.test(normalized);

  const explicitVerbRequest = new RegExp(
    `${REQUEST_VERB_PATTERN}[^.!?]{0,50}${DOCUMENT_NOUN_PATTERN}`,
    'i'
  ).test(text);

  if (explicitVerbRequest) return true;
  if (startsAsDefinitionQuestion) return false;
  if (DOCUMENT_REQUEST_REGEX.test(text)) return true;

  if (format && format !== 'AUTO') {
    if (/\b(sobre|acerca de|para|de|del)\b/.test(normalized)) return true;
  }

  if (
    /\b(para predicar|para dar un culto|para ense[ñn]ar|para exponer|para compartir en|para dirigir)\b/i.test(text)
  ) {
    return true;
  }

  return false;
}

function extractTopic(
  rawText: string,
  options: {
    passage?: PassageRef;
    bookName?: string;
    characterName?: string;
    doctrineTitle?: string;
    mirrorTitle?: string;
    previousTopic?: string;
  }
): string | undefined {
  if (APPROVAL_ONLY_REGEX.test(rawText)) return options.previousTopic;
  if (options.characterName) return options.characterName;
  if (options.doctrineTitle) return options.doctrineTitle;
  if (options.passage) {
    const range = options.passage.verseStart
      ? `${options.passage.chapter}:${options.passage.verseStart}${
          options.passage.verseEnd ? `-${options.passage.verseEnd}` : ''
        }`
      : `${options.passage.chapter}`;
    return `${options.passage.book} ${range}`;
  }
  if (options.bookName) return options.bookName;

  const candidate = rawText
    .replace(/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|saludos)[,!.\s]*/i, '')
    .replace(
      /\b(por favor|me gustar[ií]a|quisiera|quiero|necesito|puedes|podr[ií]as|ay[uú]dame a|prepara|preparar|prep[aá]rame|preparme|hazme|haz|dame|elabora|elaborar|redacta|redactar|escribe|escribir|genera|generar|crea|crear|arma|armar|comp[oó]n|compone|predicar|predica|pr[eé]dica)\b/gi,
      ' '
    )
    .replace(/\b(un|una|el|la|los|las|mi|mis|nuestro|nuestra)\s+/gi, ' ')
    .replace(
      /\b(serm[oó]n|predicaci[oó]n|pr[eé]dica|bosquejo|estudio|clase|lecci[oó]n|gu[ií]a|devocional|campa[ñn]a|serie|liturgia|ceremonia|taller|discipulado|escuela dominical)\b/gi,
      ' '
    )
    .replace(/\b(sobre|acerca de|para|de|del)\b/gi, ' ')
    .replace(/\b(ni[ñn]os?|j[oó]venes?|adolescentes?|adultos?|l[ií]deres?|mujeres|hombres|matrimonios?|parejas?)\b/gi, ' ')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedCandidate = normalize(candidate);
  const isOnlyVerb =
    /^(prepara|preparar|haz|hazlo|hazme|dame|genera|general|generalo|crea|crear|arma|armar|redacta|redactar|escribe|escribir|elabora|elaborar|quiero|necesito|puedes|podrias|ayudame|procede|adelante|dale|ok|okay|perfecto|por favor)$/.test(
      normalizedCandidate
    );

  if (
    candidate.length >= 3 &&
    !isOnlyVerb &&
    !OCCASION_ONLY_REGEX.test(normalizedCandidate) &&
    !/^(que|como|quien|por que|cuando|donde|y|o)$/.test(normalizedCandidate)
  ) {
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  if (options.mirrorTitle) return options.mirrorTitle;

  // No se reutiliza el tema anterior en una petición nueva: el estado ya lo
  // conserva cuando corresponde, y arrastrarlo aquí produciría documentos
  // sobre un tema que el usuario no volvió a pedir.
  return undefined;
}

/**
 * Extrae los slots y señales conversacionales de un turno del usuario.
 * No muta estado: la decisión corresponde a dialogueManager.
 */
export function extractTurnContext(prompt: string, options: ExtractTurnOptions = {}): DetectedTurnContext {
  const rawText = prompt.trim();
  const text = normalize(rawText);
  const slots: Partial<DialogueSlots> = {};

  // El formato y la intención documental se resuelven antes de detectar
  // seguimientos: una petición nueva con audiencia incluida no es un ajuste.
  const format = detectFormat(rawText, options.preferredFormat);
  const documentRequest = isDocumentRequest(rawText, format);

  const extracted = extractBiblicalReference(rawText);
  let passage: PassageRef | undefined;
  if (extracted) {
    passage = {
      book: extracted.bookName,
      chapter: extracted.chapter,
      verseStart: extracted.verseStart,
      verseEnd: extracted.verseEnd,
    };
  }

  const followUp = detectFollowUp(rawText, { suppressAudienceChange: documentRequest });

  if (!passage && followUp && options.previousPassage) {
    const previous = options.previousPassage;
    if (followUp.kind === 'next_verse' && followUp.verse) {
      passage = {
        book: previous.book,
        chapter: previous.chapter,
        verseStart: followUp.verse,
      };
    } else if (followUp.kind === 'chapter_change' && followUp.chapter) {
      passage = { book: previous.book, chapter: followUp.chapter };
    }
  }

  const book = passage ? findCanonicalBook(passage.book) : findCanonicalBook(rawText);
  const bookName = book?.nombre;

  const character = passage ? null : matchCharacterSafe(rawText);
  const doctrine = passage ? null : matchDoctrineSafe(rawText);
  const mirror = findBiblicalMirror(rawText);

  const audience = detectAudience(rawText);
  const task = detectTask(rawText);
  const tone = detectTone(rawText);
  const durationMinutes = detectDurationMinutes(rawText);
  const depth = detectDepth(rawText);

  if (audience) slots.audience = audience;
  if (task !== 'responder') slots.task = task;
  if (tone) slots.tone = tone;
  if (durationMinutes) slots.durationMinutes = durationMinutes;
  if (depth) slots.depth = depth;
  if (format) slots.format = format;
  if (passage) {
    slots.passage = passage;
  }

  const topic = extractTopic(rawText, {
    passage,
    bookName,
    characterName: character?.name,
    doctrineTitle: doctrine?.title,
    mirrorTitle: mirror?.titulo,
    previousTopic: options.previousTopic,
  });
  if (topic) slots.topic = topic;

  return {
    slots,
    passage,
    bookName,
    characterName: character?.name,
    mirrorId: mirror?.id,
    doctrineId: doctrine?.id,
    isQuestion: isQuestion(rawText),
    isGreeting: isGreetingOnly(rawText),
    isDocumentRequest: documentRequest,
    isOverride: OVERRIDE_REGEX.test(rawText),
    isAffirmative: /^\s*(s[ií]|claro|ok|okay|dale|adelante|perfecto|de acuerdo|est[aá] bien|hazlo|procede|conf[ií]rmo|aprobado|me gusta|suena bien)\b/i.test(
      rawText
    ),
    isNegative: /^\s*(no|mejor no|todav[ií]a no|espera|cancela|otra vez|a[uú]n no)\b/i.test(rawText),
    followUp: followUp?.kind,
    explicitGenerationCue: EXPLICIT_GENERATION_REGEX.test(rawText),
    rawText,
    normalizedText: text,
  };
}

function matchCharacterSafe(text: string) {
  return matchCharacterEntry(text);
}

function matchDoctrineSafe(text: string) {
  return matchDoctrineEntry(text);
}
