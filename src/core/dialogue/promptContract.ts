import { ChatMessage } from '../database/usuarioMemoriaService.js';
import { BrainChatMessage } from '../inference/brain/types.js';
import { EffortBudget, compactStyleFor } from '../inference/brain/effortContract.js';
import { MinistryFormat } from '../shield/types.js';
import { stripContinuationNoise, stripLocalLimitNote } from './continuation.js';
import { formatPassageRef, resolveDocumentFormat } from './deterministicAnswers.js';
import { DetectedTurnContext, DialogueMode, DialogueSlots, DialogueState } from './types.js';

const AUDIENCE_LABELS: Record<string, string> = {
  ninos: 'niños',
  jovenes: 'jóvenes',
  adultos: 'adultos',
  lideres: 'líderes y servidores',
  congregacion: 'congregación completa',
  personal: 'uso personal',
  matrimonios: 'matrimonios',
  mujeres: 'mujeres',
  hombres: 'hombres',
};

const FORMAT_LABELS: Record<string, string> = {
  SERMON_CULTO: 'sermón para culto',
  ESTUDIO_CLASE: 'clase o lección de escuela dominical',
  CELULA_JOVENES: 'guía para célula o grupo de jóvenes',
  SERIE_CAMPANA: 'serie o campaña de varias semanas',
  PERFIL_PERSONAJE: 'perfil biográfico de un personaje bíblico',
  DOCTRINA_SISTEMATICA: 'estudio de doctrina sistemática',
  CEREMONIA_ESPECIAL: 'liturgia para ceremonia especial',
  CONSEJERIA_DIALOGO: 'acompañamiento y consejería pastoral',
};

function describeSlots(state: DialogueState, context: DetectedTurnContext): string {
  const slots: DialogueSlots = state.slots;
  const lines: string[] = [];

  if (slots.topic || context.slots.topic) lines.push(`Tema: ${slots.topic ?? context.slots.topic}`);
  const passage = formatPassageRef(slots.passage);
  if (passage) lines.push(`Pasaje de trabajo: ${passage}`);
  const format = slots.format ?? context.slots.format;
  if (format) lines.push(`Formato pedido: ${FORMAT_LABELS[format] ?? format}`);
  const audience = slots.audience ?? context.slots.audience;
  if (audience) lines.push(`Audiencia: ${AUDIENCE_LABELS[audience] ?? audience}`);
  const duration = slots.durationMinutes ?? context.slots.durationMinutes;
  if (duration) lines.push(`Duración: ${duration} minutos`);
  const depth = slots.depth ?? context.slots.depth;
  if (depth) lines.push(`Profundidad: ${depth}`);
  const tone = slots.tone ?? context.slots.tone;
  if (tone) lines.push(`Tono: ${tone}`);
  if (context.doctrineId) lines.push(`Doctrina detectada: ${context.doctrineId}`);
  if (context.characterName) lines.push(`Personaje detectado: ${context.characterName}`);
  if (context.mirrorId) lines.push('Situación pastoral detectada: acompañamiento con espejo bíblico');

  return lines.length > 0 ? lines.join('\n') : 'Sin datos adicionales todavía.';
}

function modeInstruction(mode: DialogueMode): string {
  switch (mode) {
    case 'CONSULTA':
      return 'El usuario está en modo consulta: responde con claridad y brevedad, sin generar documentos.';
    case 'ESTUDIO':
      return 'El usuario está en modo estudio: prioriza contexto histórico, estructura literaria y explicación del texto.';
    case 'CONSEJERIA':
      return 'El usuario está en modo consejería: prioriza escucha, compasión, límites claros y aplicaciones concretas.';
    case 'DOCUMENTO':
      return 'El usuario está en modo documento: prepara material completo y estructurado.';
    default:
      return 'Modo automático: decide el mejor formato según el pedido.';
  }
}

export interface BrainPromptParams {
  state: DialogueState;
  context: DetectedTurnContext;
  directive: string;
  mode: DialogueMode;
  groundTruthContext?: string;
  historySummary?: string;
  /**
   * Contrato reducido para modelos de bolsillo (GGUF en el dispositivo).
   * Mantiene identidad, límites, citación, estado y directiva, pero elimina
   * explicaciones largas que solo encarecen el prefill en un teléfono.
   */
  compact?: boolean;
  /**
   * Presupuesto del perfil activo. En modelos de bolsillo limita el historial,
   * los versículos completos y el estilo de respuesta.
   */
  effort?: EffortBudget;
  /** Mensajes recientes que se envían; si falta, se usa el valor compacto. */
  historyLimit?: number;
  /**
   * El turno retoma la respuesta anterior. Cambia el cierre del contrato y la
   * instrucción de estilo: no se pide una respuesta breve ni se saluda.
   */
  continuation?: boolean;
}

/**
 * Versión corta del contrato pastoral.
 *
 * Un 0.5B–1.5B en WASM tarda mucho en procesar el contrato completo más el
 * historial. Este texto conserva lo que no se puede perder: quién es, qué no
 * debe inventar, cómo citar, qué se decidió en el turno y el texto verificado.
 */
/**
 * La directiva completa repite identidad, límites y reglas de citación que ya
 * están en el contrato compacto. En un modelo de bolsillo esa duplicación se
 * paga en prefill; conservamos solo la instrucción específica del turno.
 */
function compactDirective(directive: string): string {
  const commonLine =
    /^(act[uú]a como te[oó]logo|nivel del usuario:|distingue con claridad|no inventes|marca cada cita|haz una sola pregunta)/i;
  const specific = directive
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !commonLine.test(line))
    .join(' ');

  return truncate(specific.length > 0 ? specific : directive, 240);
}

function compactModeInstruction(mode: DialogueMode): string {
  switch (mode) {
    case 'CONSULTA':
      return 'Modo consulta: respuesta breve, sin documento.';
    case 'ESTUDIO':
      return 'Modo estudio: contexto y explicación del texto.';
    case 'CONSEJERIA':
      return 'Modo consejería: escucha, compasión y límites claros.';
    case 'DOCUMENTO':
      return 'Modo documento: material completo y estructurado.';
    default:
      return 'Modo automático.';
  }
}

/**
 * El contexto verificado llega como líneas `[CANON_INMUTABLE: ...]`.
 * Recortarlo por caracteres partía el versículo por la mitad y dejaba al modelo
 * con una cita incompleta. Aquí se conservan versículos enteros, en orden de
 * relevancia, y se descarta el resto del bloque.
 */
export function compactGroundTruth(context: string, maxVerses: number): string {
  const verses = context
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[CANON_INMUTABLE:'))
    .slice(0, Math.max(1, maxVerses));

  if (verses.length > 0) return verses.join('\n');

  // Sin el formato esperado, se conserva el texto completo dentro de un límite
  // razonable; nunca se corta una línea de versículo a la mitad.
  return truncate(context.trim(), 600);
}

function compactStyleInstruction(effort?: EffortBudget, continuation?: boolean): string {
  if (continuation) {
    return 'Continúa la respuesta anterior exactamente donde se cortó. No saludes, no repitas lo ya escrito y conserva el mismo tema, formato y nivel de detalle.';
  }

  switch (effort ? compactStyleFor(effort) : 'brief') {
    case 'normal':
      return 'Responde en español claro, en 2–5 frases. No repitas ideas ni palabras.';
    case 'deep':
      return 'Responde en español claro y ordenado. Usa párrafos cortos y desarrolla la idea sin repetirte.';
    default:
      return 'Responde en español claro, en 1–3 frases (máx. 80 palabras). No repitas frases ni palabras.';
  }
}

function buildCompactSystemPrompt(params: BrainPromptParams): string {
  const { state, context, directive, mode, groundTruthContext, historySummary } = params;

  // El prefill es el coste dominante en un 0.5B: cada frase del contrato se
  // paga antes del primer token. El bloque estable va primero y el estado del
  // turno al final, para que la caché del motor pueda reutilizar el prefijo en
  // los turnos siguientes. Conservamos identidad, límites, citación, estado y
  // tarea, pero en formato telegráfico.
  const sections = [
    'Eres VerboVivo, asistente bíblico y pastoral.',
    'No inventes citas, fechas ni palabras originales; si no sabes, dilo. En riesgo de daño, prioriza la seguridad.',
    'Cita con [CITA: Libro Cap:Vers]; el sistema añade el texto literal. Si piden un versículo, responde solo con la cita.',
    compactStyleInstruction(params.effort, params.continuation),
    '',
    `CONTEXTO: tradición ${state.tradition}; nivel ${state.level}.`,
    compactModeInstruction(mode),
    `ESTADO: ${truncate(describeSlots(state, context), 240)}`,
    historySummary && historySummary.trim().length > 0
      ? `CONVERSACIÓN PREVIA:\n${truncate(historySummary.trim(), 360)}`
      : '',
    `TAREA: ${compactDirective(directive)}`,
    groundTruthContext && groundTruthContext.trim().length > 0
      ? `BIBLIA VERIFICADA:\n${compactGroundTruth(
          groundTruthContext,
          params.effort?.groundTruthVerses ?? 3
        )}`
      : '',
  ];

  return sections.filter((section) => section !== '').join('\n');
}

/**
 * Construye el mensaje de sistema que recibe cualquier cerebro (Ollama, LM Studio, API compatible).
 * Es deliberadamente agnóstico del modelo: todo lo específico vive aquí, no en el adaptador.
 */
export function buildSystemPrompt(params: BrainPromptParams): string {
  if (params.compact) {
    return buildCompactSystemPrompt(params);
  }

  const { state, context, directive, mode, groundTruthContext, historySummary } = params;

  const sections = [
    `Eres VerboVivo, un asistente experto en teología bíblica, exégesis, homilética y consejería pastoral.`,
    `Tu tradición de trabajo es: ${state.tradition}. No impones otras tradiciones ni ridiculizas al usuario; cuando exista debate legítimo, lo explicas con honestidad.`,
    `Nivel teológico del usuario: ${state.level}. Adapta el vocabulario sin vaciar el contenido.`,
    modeInstruction(mode),
    '',
    'IDENTIDAD Y LÍMITES',
    '- Eres un asistente, no un profeta ni una autoridad eclesiástica. No das órdenes en nombre de Dios ni reclamas revelación nueva.',
    '- En consejería: acompañas y orientas, pero no diagnosticas trastornos ni sustituyes a un médico o psicólogo. Si hay riesgo de daño, prioriza la seguridad y recomienda ayuda profesional o líneas de emergencia.',
    '- No inventes versículos, citas, fechas, datos históricos ni palabras hebreas o griegas que no puedas sostener.',
    '- Si no sabes algo, dilo. Es preferible una respuesta humilde y precisa que una respuesta inventada.',
    '',
    'REGLA DE CITACIÓN',
    '- Cuando cites texto bíblico literal, usa exactamente el formato [CITA: Libro Cap:Vers] o [CITA: Libro Cap:Vers-Vers].',
    '- El sistema sustituirá esa marca por el texto canónico de la base local. No escribas el versículo de memoria si puedes usar la marca.',
    '- Distingue siempre entre el texto bíblico, la interpretación y la aplicación pastoral.',
    '',
    'ESTADO DEL DIÁLOGO',
    `Acción decidida para este turno: ${context.isDocumentRequest ? 'petición de documento' : 'conversación'}.`,
    `Fase: ${state.phase}. Turno: ${state.turnCount + 1}.`,
    describeSlots(state, context),
    historySummary ? `\nRESUMEN DE LA CONVERSACIÓN PREVIA\n${historySummary}` : '',
    '',
    'DIRECTIVA PARA ESTE TURNO',
    directive,
    params.continuation
      ? [
          '',
          'CONTINUIDAD',
          'El usuario pidió continuar la respuesta anterior. Retómala en el punto exacto donde se cortó, sin saludar, sin resumir lo ya dicho y sin cambiar de tema ni de formato.',
          'No reescribas desde el principio ni copies el texto anterior: escribe solo lo que sigue.',
          'No repitas la última frase completa: empalma con lo que sigue.',
        ].join('\n')
      : '',
    '',
    'ESTILO DE SALIDA',
    '- Responde en español claro, cálido y directo.',
    '- Usa Markdown: encabezados ###, listas y tablas solo cuando aporten claridad.',
    '- Si generas un documento, desarrolla cada sección con contenido real, no con títulos vacíos.',
    params.continuation
      ? '- No cierres con una pregunta ni con una despedida: continúa el desarrollo anterior.'
      : '- Termina con una sola pregunta, y solo si ayuda a avanzar. No hagas interrogatorios.',
  ];

  if (groundTruthContext && groundTruthContext.trim().length > 0) {
    sections.push(
      '',
      'TEXTO BÍBLICO VERIFICADO PARA ESTE TURNO (prioridad máxima)',
      groundTruthContext.trim(),
      'Usa exclusivamente estas citas literales cuando estén disponibles; no las alteres.'
    );
  }

  return sections.filter((section) => section !== '').join('\n');
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

/** Conserva el final del texto: es donde se cortó la respuesta anterior. */
function truncateTail(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;

  const slice = trimmed.slice(-max);
  const boundary = slice.search(/[\s\n]/);
  const clean = boundary >= 0 ? slice.slice(boundary + 1) : slice;
  return `…${clean.trimStart()}`;
}

/**
 * En un asistente no basta con el principio del mensaje. El final contiene el
 * punto exacto donde quedó la respuesta, y es lo que permite continuar o
 * retomar la conversación después de cambiar de cerebro.
 *
 * Dos precauciones aprendidas en el RedMagic:
 * - Las notas del sistema («límite de tokens», «pulsa Ampliar») no son prosa.
 *   Un 0.5B las copia como parte de su propia respuesta.
 * - El marcador «[…]» también se copiaba literalmente. El historial se une con
 *   un salto de párrafo, sin marcas que el modelo pueda repetir.
 * En modo compacto solo se conserva la cola: el cerebro de bolsillo ya tiene el
 * hilo y no puede pagar el prefill de un mensaje largo.
 */
function truncateHistoryContent(value: string, isAssistant: boolean, compact: boolean): string {
  const trimmed = value.trim();
  if (!isAssistant) return truncate(trimmed, compact ? 320 : 900);

  const clean = stripLocalLimitNote(stripContinuationNoise(trimmed))
    // Respuestas guardadas por versiones anteriores incluían este marcador de
    // elisión; un modelo pequeño lo repite como si fuera prosa.
    .replace(/\n?\[…\]\n?/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (clean.length === 0) return '';

  if (compact) return truncateTail(clean, 360).replace(/^…/, '');

  const limit = 2000;
  if (clean.length <= limit) return clean;

  const headBudget = 400;
  const head = clean.slice(0, headBudget).trimEnd();
  const tail = truncateTail(clean, limit - headBudget).replace(/^…/, '');
  return `${head}\n\n${tail}`;
}

function toBrainMessage(message: ChatMessage, compact = false): BrainChatMessage | null {
  if (!message.content || message.content.trim().length === 0) return null;
  if (message.role === 'system') return null;

  const isAssistant = message.role === 'assistant';
  const content = truncateHistoryContent(message.content, isAssistant, compact);
  if (content.trim().length === 0) return null;

  return {
    role: isAssistant ? 'assistant' : 'user',
    content,
  };
}

/**
 * Devuelve el historial reciente listo para el modelo, sin duplicar el turno actual.
 *
 * En modelos de bolsillo el historial se recorta a los últimos intercambios:
 * cada mensaje extra se paga en prefill y en un WebView de un solo hilo eso
 * puede añadir decenas de segundos a la primera palabra.
 */
export function buildHistoryMessages(
  history: ChatMessage[] | undefined,
  currentPrompt: string,
  compact = false,
  limit?: number
): BrainChatMessage[] {
  if (!history || history.length === 0) return [];

  const normalizedCurrent = currentPrompt.trim().toLowerCase();
  const recentSize = Math.max(1, limit ?? (compact ? 4 : 16));
  const recent = history.slice(-recentSize);

  return recent
    .filter((message, index) => {
      if (index !== recent.length - 1) return true;
      return !(
        message.role === 'user' &&
        message.content.trim().toLowerCase() === normalizedCurrent
      );
    })
    .map((message) => toBrainMessage(message, compact))
    .filter((message): message is BrainChatMessage => message !== null);
}

export function buildBrainMessages(params: BrainPromptParams & {
  prompt: string;
  history?: ChatMessage[];
}): BrainChatMessage[] {
  const system = buildSystemPrompt(params);
  const history = buildHistoryMessages(
    params.history,
    params.prompt,
    params.compact,
    params.historyLimit
  );

  return [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: params.prompt.trim() },
  ];
}

export interface ContinuationPromptParams extends BrainPromptParams {
  prompt: string;
  previousUser?: string;
  previousAssistant: string;
}

/**
 * Mensajes para retomar una respuesta cortada.
 *
 * No se reenvía todo el historial: el último intercambio (petición original +
 * cola de la respuesta) y una orden explícita bastan para que cualquier modelo
 * —también uno recién cargado tras cambiar de cerebro— siga el hilo sin
 * saludar. Si se enviara solo «continúa», un modelo pequeño no tendría qué
 * continuar.
 */
export function buildContinuationMessages(params: ContinuationPromptParams): BrainChatMessage[] {
  const system = buildSystemPrompt({ ...params, continuation: true });
  const messages: BrainChatMessage[] = [{ role: 'system', content: system }];

  const previousUser = params.previousUser?.trim();
  if (previousUser) {
    messages.push({
      role: 'user',
      content: truncate(previousUser, params.compact ? 600 : 1400),
    });
  }

  messages.push({
    role: 'assistant',
    content: truncateTail(params.previousAssistant, params.compact ? 1400 : 3000),
  });

  messages.push({
    role: 'user',
    content:
      'Continúa exactamente donde se cortó la respuesta anterior. No saludes, no repitas lo ya escrito, no reescribas desde el principio y no cambies de tema ni de formato. Escribe solo el texto nuevo.',
  });

  return messages;
}

/**
 * Prompt enriquecido para el compositor determinista cuando debe generar un documento.
 */
export function buildDocumentPrompt(
  prompt: string,
  state: DialogueState,
  context: DetectedTurnContext,
  format: MinistryFormat
): string {
  const slots = state.slots;
  const parts = [
    `Elabora un documento completo en formato ${FORMAT_LABELS[format] ?? format}.`,
    slots.topic ? `Tema: ${slots.topic}.` : context.slots.topic ? `Tema: ${context.slots.topic}.` : '',
    formatPassageRef(slots.passage) ? `Pasaje base: ${formatPassageRef(slots.passage)}.` : '',
    slots.audience ? `Audiencia: ${AUDIENCE_LABELS[slots.audience] ?? slots.audience}.` : '',
    slots.durationMinutes ? `Duración: ${slots.durationMinutes} minutos.` : '',
    slots.depth === 'breve' ? 'Extensión breve y directa.' : '',
    slots.depth === 'profundo' ? 'Desarrollo profundo y detallado.' : '',
    `Nivel teológico del usuario: ${state.level}.`,
    `Pedido original del usuario: ${prompt.trim()}`,
  ];

  return parts.filter((part) => part !== '').join(' ');
}

export function buildDocumentPromptFromSlots(
  state: DialogueState,
  context: DetectedTurnContext,
  prompt: string
): string {
  return buildDocumentPrompt(prompt, state, context, resolveDocumentFormat(state, context));
}
