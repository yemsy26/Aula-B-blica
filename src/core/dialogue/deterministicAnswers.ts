import { CORE_VERSES_RV1909 } from '../database/seedData.js';
import { DynamicTheologicalComposer } from '../inference/localEngine.js';
import { findBiblicalMirror } from '../rag/casuistryMapper.js';
import { MinistryFormat, CrisisDetectionResult, TheologicalRoute, UserTheologicalLevel } from '../shield/types.js';
import { extractTurnContext } from './slotExtractor.js';
import {
  CharacterEntry,
  DoctrineEntry,
  matchCharacterEntry,
  matchDoctrineEntry,
} from './theologyCatalog.js';
import { DetectedTurnContext, DialogueState } from './types.js';

const AVAILABLE_VERSES = new Set(
  CORE_VERSES_RV1909.map((verse) => `${verse.libro_nombre} ${verse.capitulo}:${verse.versiculo}`)
);

const FORMAT_LABELS: Record<MinistryFormat, string> = {
  AUTO: 'Según lo que mejor sirva al tema',
  SERMON_CULTO: 'Sermón para culto',
  ESTUDIO_CLASE: 'Clase / lección de escuela dominical',
  CELULA_JOVENES: 'Guía para célula o grupo de jóvenes',
  SERIE_CAMPANA: 'Serie o campaña de varias semanas',
  PERFIL_PERSONAJE: 'Perfil biográfico de un personaje bíblico',
  DOCTRINA_SISTEMATICA: 'Estudio de doctrina sistemática',
  CEREMONIA_ESPECIAL: 'Liturgia para ceremonia especial',
  CONSEJERIA_DIALOGO: 'Acompañamiento y consejería pastoral',
};

const AUDIENCE_LABELS: Record<string, string> = {
  ninos: 'Niños',
  jovenes: 'Jóvenes',
  adultos: 'Adultos',
  lideres: 'Líderes y servidores',
  congregacion: 'Congregación completa',
  personal: 'Uso personal / devocional',
  matrimonios: 'Matrimonios',
  mujeres: 'Mujeres',
  hombres: 'Hombres',
};

function citationTag(reference: string): string | null {
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const book = match[1];
  const chapter = parseInt(match[2], 10);
  const start = parseInt(match[3], 10);
  const end = match[4] ? parseInt(match[4], 10) : start;

  if (end < start) return null;

  for (let verse = start; verse <= end; verse++) {
    if (!AVAILABLE_VERSES.has(`${book} ${chapter}:${verse}`)) return null;
  }

  return `[CITA: ${reference}]`;
}

function buildCitationBlock(references: string[], limit = 3): string {
  const tags = references
    .map((reference) => citationTag(reference))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, limit);

  if (tags.length === 0) {
    return '';
  }

  return `\n**Texto bíblico para leer y verificar**\n${tags.join('\n')}\n`;
}

function closingQuestion(text: string): string {
  return `\n---\n${text}`;
}

export function composeSmallTalk(): string {
  return [
    'Hola. Soy VerboVivo, tu acompañante de estudio bíblico, exégesis y consejería pastoral.',
    '',
    'Puedo conversar contigo, explicarte un pasaje o una doctrina, acompañarte en una situación difícil o preparar un sermón, una clase y una campaña. Si algo no lo tengo verificado en la base bíblica local, te lo diré en lugar de inventarlo.',
    '',
    '¿Qué quieres trabajar hoy: entender un texto, estudiar una doctrina, preparar una enseñanza o hablar de algo que estás viviendo?',
  ].join('\n');
}

export function composeDoctrineAnswer(entry: DoctrineEntry): string {
  const truths = entry.coreTruths.map((truth) => `- ${truth}`).join('\n');
  const errors = entry.misconceptions.map((error) => `- ${error}`).join('\n');
  const applications = entry.application.map((application) => `- ${application}`).join('\n');

  return [
    `### ${entry.title}`,
    '',
    entry.summary,
    '',
    '**Lo que enseña la Escritura**',
    truths,
    buildCitationBlock(entry.keyVerses),
    '**Errores que conviene evitar**',
    errors,
    '',
    '**Aplicación pastoral**',
    applications,
    entry.advancedNote ? `\n**Nota de profundidad**\n${entry.advancedNote}\n` : '',
    closingQuestion(
      '¿Quieres que veamos esta doctrina en un pasaje concreto, que la compare con alguna idea que hayas escuchado, o que la prepare para enseñarla?'
    ),
  ]
    .filter((part) => part !== '')
    .join('\n');
}

export function composeCharacterAnswer(entry: CharacterEntry): string {
  const moments = entry.faithMoments.map((moment) => `- ${moment}`).join('\n');
  const failures = entry.failures.length > 0 ? entry.failures.map((failure) => `- ${failure}`).join('\n') : '- No se registra una caída pública relevante en el texto canónico.';
  const lessons = entry.lessons.map((lesson) => `- ${lesson}`).join('\n');

  return [
    `### ${entry.name}`,
    '',
    `*${entry.title}*`,
    '',
    entry.summary,
    '',
    '**Momentos de fe y obediencia**',
    moments,
    buildCitationBlock(entry.keyVerses),
    '**Sus caídas y la gracia de Dios**',
    failures,
    'La Escritura no esconde los fracasos de sus personajes: los muestra para que aprendamos a depender de la gracia y no de nuestro propio historial.',
    '',
    '**Lecciones para hoy**',
    lessons,
    '',
    '**Conexión con Cristo**',
    entry.christConnection,
    closingQuestion(`¿Quieres que profundicemos en uno de estos episodios de ${entry.name} o que lo conviertas en un estudio para tu grupo?`),
  ]
    .filter((part) => part !== '')
    .join('\n');
}

export function composeMirrorAnswer(_context: DetectedTurnContext, prompt: string): string {
  const mirror = findBiblicalMirror(prompt);
  if (!mirror) {
    return composeGeneralCounseling();
  }

  const steps = mirror.aplicacionPractica.map((step) => `- ${step}`).join('\n');

  return [
    `### ${mirror.titulo}`,
    '',
    'Gracias por confiarme lo que estás viviendo. No voy a darte una respuesta superficial ni un diagnóstico: vamos a mirar tu situación a la luz de la Escritura y a pensar pasos concretos.',
    '',
    `**Un espejo bíblico: ${mirror.personaje}** (${mirror.referenciaBiblica})`,
    mirror.historiaEspejo,
    '',
    '**Principio central**',
    mirror.principioCentral,
    buildCitationBlock(mirror.versiculosClave),
    '**Pasos prácticos para esta semana**',
    steps,
    '',
    'Esto es acompañamiento pastoral y no sustituye la atención de un profesional de la salud mental. Si el dolor se vuelve incapacitante, buscar ayuda médica o psicológica también es un acto de sabiduría y de mayordomía.',
    closingQuestion(mirror.preguntaPingPong),
  ].join('\n');
}

function composeGeneralCounseling(): string {
  return [
    '### Acompañamiento pastoral',
    '',
    'Gracias por abrir esto conmigo. Antes de darte versículos o consejos, quiero entender bien lo que estás viviendo, porque una respuesta genérica puede herir más de lo que ayuda.',
    '',
    'La Escritura nos invita a llevar nuestras cargas al Señor y a no caminar solos: «Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros» (1 Pedro 5:7). Eso no niega el dolor ni lo minimiza; lo pone delante de Dios y dentro de una comunidad que acompaña.',
    '',
    'Esto es acompañamiento pastoral y no sustituye la atención de un profesional de la salud mental. Si el dolor se vuelve incapacitante, buscar ayuda médica o psicológica también es un acto de sabiduría.',
    closingQuestion('¿Qué es lo que más pesa hoy: la situación en sí, el miedo a lo que pueda pasar, o la culpa por cómo has reaccionado?'),
  ].join('\n');
}

export function formatPassageRef(passage?: { book: string; chapter: number; verseStart?: number; verseEnd?: number }): string {
  if (!passage) return '';
  const range = passage.verseStart
    ? `:${passage.verseStart}${passage.verseEnd ? `-${passage.verseEnd}` : ''}`
    : '';
  return `${passage.book} ${passage.chapter}${range}`;
}

export function composePassageOrBookAnswer(params: {
  prompt: string;
  route: TheologicalRoute;
  level: UserTheologicalLevel;
  availableCitations?: string[];
}): string {
  return DynamicTheologicalComposer.compose(
    params.prompt,
    params.route,
    params.level,
    params.availableCitations ?? [],
    undefined,
    null,
    undefined
  );
}

export function composeDeterministicAnswer(params: {
  prompt: string;
  context: DetectedTurnContext;
  state: DialogueState;
  availableCitations?: string[];
}): string {
  const { prompt, context, state } = params;

  if (context.isGreeting) {
    return composeSmallTalk();
  }

  const character = context.characterName ? matchCharacterEntry(context.characterName) : null;
  if (character && !context.passage?.verseStart) {
    return composeCharacterAnswer(character);
  }

  const doctrine = context.doctrineId ? matchDoctrineEntry(context.doctrineId) : null;
  if (doctrine) {
    return composeDoctrineAnswer(doctrine);
  }

  if (context.mirrorId) {
    return composeMirrorAnswer(context, prompt);
  }

  const effectivePrompt = context.passage
    ? `${prompt} (${formatPassage(context)})`
    : prompt;

  return composePassageOrBookAnswer({
    prompt: effectivePrompt,
    route: selectRoute(context),
    level: state.level,
    availableCitations: params.availableCitations,
  });
}

export function selectRoute(context: DetectedTurnContext): TheologicalRoute {
  if (context.slots.task === 'aconsejar' || context.mirrorId) return '[CHARLA_CONSEJERIA]';
  if (context.isDocumentRequest || context.slots.format) return '[CREADOR_ESTUDIO]';
  if (context.isQuestion || context.passage) return '[BUSQUEDA_EXACTA]';
  return '[CHARLA_CONSEJERIA]';
}

export function formatPassage(context: DetectedTurnContext): string {
  return formatPassageRef(context.passage);
}

export function resolveDocumentFormat(state: DialogueState, context: DetectedTurnContext): MinistryFormat {
  if (state.slots.format) return state.slots.format;
  if (context.slots.format) return context.slots.format;
  if (context.characterName) return 'PERFIL_PERSONAJE';
  if (state.slots.task === 'predicar') return 'SERMON_CULTO';
  if (state.slots.task === 'ensenar') return 'ESTUDIO_CLASE';
  if (state.slots.task === 'ceremonia') return 'CEREMONIA_ESPECIAL';
  return 'ESTUDIO_CLASE';
}

export function composePlanProposal(state: DialogueState, context: DetectedTurnContext): string {
  const slots = state.slots;
  const topic = slots.topic ?? context.slots.topic ?? 'el tema que conversamos';
  const passage = formatPassageRef(slots.passage);
  const format = resolveDocumentFormat(state, context);
  const audience = slots.audience ? AUDIENCE_LABELS[slots.audience] : 'Congregación general';
  const duration = slots.durationMinutes ? `${slots.durationMinutes} minutos` : 'Duración estándar';
  const depth = slots.depth === 'breve' ? 'Breve y directo' : slots.depth === 'profundo' ? 'Profundo y detallado' : 'Desarrollo equilibrado';

  const lines = [
    '### Propuesta de trabajo',
    '',
    `Antes de escribir el documento completo, quiero confirmar el enfoque para no entregarte algo genérico.`,
    '',
    `- **Tema:** ${topic}`,
    passage ? `- **Pasaje base:** ${passage}` : '- **Pasaje base:** lo elegimos juntos según el tema',
    `- **Formato:** ${FORMAT_LABELS[format] ?? format}`,
    `- **Audiencia:** ${audience}`,
    `- **Extensión:** ${depth} · ${duration}`,
    `- **Nivel teológico:** ${state.level}`,
  ];

  return lines.join('\n') + closingQuestion(
    '¿Lo genero así o ajustamos el tema, el pasaje, la audiencia o el formato? Si ya está bien, responde «hazlo» y lo redacto completo.'
  );
}

export function composeClarificationQuestion(context: DetectedTurnContext): string {
  const format = context.slots.format;

  if (format === 'ESTUDIO_CLASE') {
    return 'Para preparar la clase con precisión: ¿sobre qué pasaje o tema quieres que gire, y a qué grupo va dirigida?';
  }
  if (format === 'SERMON_CULTO') {
    return 'Para preparar el sermón con precisión: ¿cuál es el pasaje base o el tema central que quieres exponer?';
  }
  if (format === 'SERIE_CAMPANA') {
    return 'Para armar la serie: ¿cuál es el tema general y en cuántas semanas quieres desarrollarlo?';
  }
  if (format === 'CEREMONIA_ESPECIAL') {
    return 'Para preparar la ceremonia: ¿de qué tipo es (boda, funeral, dedicación) y qué tono o elementos deseas incluir?';
  }
  if (format === 'CELULA_JOVENES') {
    return 'Para la guía de célula: ¿cuál es el tema o pasaje y qué edad aproximada tiene el grupo?';
  }

  return 'Para preparar algo útil y no genérico: ¿cuál es el tema o pasaje central, y para quién lo necesitas?';
}

export function composeCancellationNotice(): string {
  return 'Generación cancelada. Podemos ajustar la propuesta o retomarla cuando quieras.';
}

/**
 * Respuesta a una petición directa de versículo. La cita se resuelve contra
 * SQLite (el marcador [CITA: …] lo convierte el inyector en texto literal) y
 * el modelo no participa en la transcripción.
 */
export function composeVerifiedVerseAnswer(verse: { reference: string; topic?: string }): string {
  const topic = verse.topic?.trim();
  const intro = topic
    ? `Te comparto esta cita sobre **${topic}**, tal como está en la Biblia local:`
    : 'Te comparto esta cita tal como está en la Biblia local:';

  return [
    intro,
    '',
    `[CITA: ${verse.reference}]`,
    '',
    'Si quieres, la leemos juntos y la aplicamos a lo que estás viviendo.',
  ].join('\n');
}

export function composeDocumentAnswer(params: {
  prompt: string;
  state: DialogueState;
  context: DetectedTurnContext;
  availableCitations?: string[];
}): string {
  const format = resolveDocumentFormat(params.state, params.context);
  const passage = formatPassageRef(params.state.slots.passage ?? params.context.passage);
  const topic = params.state.slots.topic ?? params.context.slots.topic;

  // El prompt que recibe el compositor debe describir el tema, no la frase de
  // aprobación («hazlo»). De lo contrario el título del documento se contamina.
  const subject = topic ?? passage ?? params.prompt;
  const enrichedPrompt = passage && topic ? `${subject}. ${passage}` : subject;

  return DynamicTheologicalComposer.compose(
    enrichedPrompt,
    '[CREADOR_ESTUDIO]',
    params.state.level,
    params.availableCitations ?? [],
    undefined,
    null,
    format
  );
}

export function composeCrisisAnswer(crisis: CrisisDetectionResult): string {
  const action = crisis.immediatePastoralAction;
  if (!action) {
    return 'Estoy contigo en este momento. Por favor, busca ahora mismo a una persona de confianza y comunícate con los servicios de emergencia de tu país. No tienes que atravesar esto en soledad.';
  }

  const anchors = action.biblicalAnchors.map((anchor) => `- ${anchor}`).join('\n');

  return [
    '### Estoy contigo',
    '',
    action.pastoralMessage,
    '',
    '**Lo que la Escritura dice**',
    anchors,
    '',
    '**Ahora mismo, por favor**',
    '- No te quedes solo: llama o escribe a una persona de confianza y dile cómo estás.',
    '- Si estás en peligro inmediato, comunícate con los servicios de emergencia de tu país.',
    `- ${action.helplineRecommendation}`,
    '',
    'No voy a darte un sermón ni un diagnóstico. Tu vida tiene valor, y buscar ayuda concreta es el paso más importante de este momento.',
  ].join('\n');
}

export function composeHonestUnknown(prompt: string): string {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('fecha') || normalized.includes('año')) {
    return 'No tengo ese dato histórico verificado dentro de la base local, y prefiero no inventarlo. Puedo ayudarte con lo que sí está en el texto bíblico o decirte qué conviene consultar en una fuente externa. ¿Quieres que enfoquemos la respuesta en el pasaje?';
  }
  return 'No tengo una respuesta verificada para eso en mi base local, y prefiero decírtelo antes que inventar. ¿Puedes darme un poco más de contexto o reformular la pregunta?';
}

export function describeDetectedContext(prompt: string): DetectedTurnContext {
  return extractTurnContext(prompt);
}
