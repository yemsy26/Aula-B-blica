import { CrisisDetectionResult } from './types.js';

// Triggers de Severidad Crítica (Riesgo Inminente de Autolesión o Suicidio)
const CRITICAL_TRIGGERS: string[] = [
  'suicidarme',
  'suicidio',
  'matarme',
  'quitarme la vida',
  'acabar con mi vida',
  'terminar con mi vida',
  'no quiero vivir',
  'no quiero seguir viviendo',
  'quiero morir',
  'deseo morir',
  'cortarme las venas',
  'autolesionarme',
  'autolesion',
  'ahorcarme',
  'tomar pastillas para no despertar',
  'dejar de existir',
  'desaparecer para siempre',
];

// Triggers de Severidad Media (Angustia severa, desesperación profunda, soledad extrema)
const MEDIUM_TRIGGERS: string[] = [
  'ya no puedo mas',
  'ya no aguanto mas',
  'depresion severa',
  'depresion profunda',
  'mi vida no tiene sentido',
  'no le importo a nadie',
  'dios me olvido',
  'dios me desamparo',
  'siento que estorbo',
  'dolor insoportable',
  'ganas de llorar todo el dia',
  'vacio en el pecho',
  'oscuridad total',
  'nadie me quiere',
];

const CRITICAL_PASTORAL_ACTION = {
  pastoralMessage:
    'Hermano(a), tu vida tiene un valor infinito e irremplazable a los ojos del Señor. Este dolor que sientes no es el final de tu historia. No estás solo(a) en esta tormenta y no tienes que llevar esta carga en silencio.',
  biblicalAnchors: [
    'Salmos 34:18 (Cercano está Jehová a los quebrantados de corazón; y salva a los contritos de espíritu)',
    'Jeremías 29:11 (Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal)',
    'Mateo 11:28 (Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar)',
    'Isaías 41:10 (No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo)',
  ],
  helplineRecommendation:
    'Por favor, comunícate de inmediato con una persona de confianza, tu pastor o los servicios locales de ayuda y prevención: Teléfono de la Esperanza (Internacional) o llama a la línea de emergencia local de tu país.',
};

const MEDIUM_PASTORAL_ACTION = {
  pastoralMessage:
    'Comprendo el profundo peso que sientes en tu corazón en este momento. La Biblia nos muestra que incluso hombres como David y Elías atravesaron valles de densa sombra. Dios escucha cada uno de tus suspiros.',
  biblicalAnchors: [
    'Salmos 42:11 (¿Por qué te abates, oh alma mía, y por qué te turbas dentro de mí? Espera en Dios)',
    '1 Pedro 5:7 (Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros)',
  ],
  helplineRecommendation:
    'Tómate un momento para orar y compartir esta carga con un mentor espiritual o profesional de salud mental.',
};

/**
 * Normaliza acentos y puntuación para detección insensible a caracteres diacríticos
 */
function stripDiacritics(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Expresiones que, aunque contienen una negación, siguen siendo una señal de riesgo.
 * Deben evaluarse antes de neutralizar las negaciones.
 */
const CRISIS_OVERRIDE_PATTERNS: RegExp[] = [
  /\bya no quiero (?:vivir|seguir viviendo|existir|estar aqui)\b/,
  /\bno quiero (?:seguir )?vivir(?: mas| mas tiempo| un dia mas)?\b/,
  /\bno quiero estar (?:vivo|viva)\b/,
  /\bno quiero despertar(?: manana)?\b/,
  /\bno me quiero despertar\b/,
];

/**
 * Neutraliza negaciones seguras ("no quiero morir") y modismos ("morir de risa")
 * para evitar falsos positivos de crisis.
 */
function neutralizeSafeExpressions(text: string): string {
  let clean = text;

  // Modismos cotidianos
  clean = clean
    .replace(/\b(?:me )?muero de risa\b/g, ' ')
    .replace(/\bmorir(?:me)? de (?:risa|verguenza|pena|sueno|hambre|sed|calor|frio|amor)\b/g, ' ')
    .replace(/\bmatarme a trabajar\b/g, ' ')
    .replace(/\bme mato (?:trabajando|estudiando)\b/g, ' ');

  // Contexto informativo o académico sobre el suicidio
  const informational =
    /\b(?:que dice|habla|hablar|tema|estudio|prevencion|prevenir|senales|como ayudar|ayudar a alguien|acompanar a alguien)\b[^.!?]{0,50}\bsuicidio\b/.test(
      clean
    ) && !/\b(?:quiero|deseo|pienso|voy a|tengo ganas de)\b/.test(clean);
  if (informational) {
    clean = clean.replace(/\bsuicidio\b/g, ' ');
  }

  // Negaciones explícitas de querer dañarse
  clean = clean
    .replace(
      /\bno\s+(?:quiero|deseo|pretendo|pienso|tengo (?:ganas|intencion|intenciones) de|voy a)\s+(?:suicidarme|matarme|morir|quitarme la vida|acabar con mi vida|terminar con mi vida|cortarme las venas|autolesionarme|dejar de existir|desaparecer para siempre)\b/g,
      ' '
    )
    .replace(/\bno me (?:quiero|voy a) (?:matar|suicidar|morir)\b/g, ' ')
    .replace(/\bno es que (?:quiera|desee|piense) (?:morir|matarme|suicidarme)\b/g, ' ');

  return clean;
}

/**
 * Detecta indicadores de crisis emocional o espiritual en milisegundos (< 1 ms).
 */
export function detectCrisis(text: string): CrisisDetectionResult {
  if (!text || text.trim() === '') {
    return { isCrisis: false, severity: 'NONE', matchedTriggers: [] };
  }

  const clean = stripDiacritics(text);
  const matchedTriggers: string[] = [];

  // 0. Señales que prevalecen incluso con negación ("ya no quiero vivir")
  if (CRISIS_OVERRIDE_PATTERNS.some((pattern) => pattern.test(clean))) {
    return {
      isCrisis: true,
      severity: 'CRITICA',
      matchedTriggers: ['negacion_de_vivir'],
      immediatePastoralAction: CRITICAL_PASTORAL_ACTION,
    };
  }

  const safeText = neutralizeSafeExpressions(clean);

  // 1. Evaluación de Triggers Críticos
  for (const trigger of CRITICAL_TRIGGERS) {
    if (safeText.includes(trigger)) {
      matchedTriggers.push(trigger);
    }
  }

  if (matchedTriggers.length > 0) {
    return {
      isCrisis: true,
      severity: 'CRITICA',
      matchedTriggers,
      immediatePastoralAction: CRITICAL_PASTORAL_ACTION,
    };
  }

  // 2. Evaluación de Triggers de Severidad Media
  for (const trigger of MEDIUM_TRIGGERS) {
    if (safeText.includes(trigger)) {
      matchedTriggers.push(trigger);
    }
  }

  if (matchedTriggers.length > 0) {
    return {
      isCrisis: true,
      severity: 'MEDIA',
      matchedTriggers,
      immediatePastoralAction: MEDIUM_PASTORAL_ACTION,
    };
  }

  return {
    isCrisis: false,
    severity: 'NONE',
    matchedTriggers: [],
  };
}
