import { TheologicalRoute, UserTheologicalLevel, MinistryFormat } from './types.js';
import { findCanonicalBook } from '../database/canonicalBooks.js';

// Patrones de búsqueda exacta: Citas bíblicas explícitas, concordancia, o búsqueda textual directa
const VERSE_CITATION_REGEX = /\b(?:[1-3]\s*)?[A-ZÁÉÍÓÚ][a-záéíóúñ]+\s+\d{1,3}(?:[:.]\d{1,3}(?:-\d{1,3})?)?\b/;
const STRONG_CODE_REGEX = /\b[HGhg]\d{1,5}\b/;
const EXACT_SEARCH_KEYWORDS = [
  'donde dice',
  'dónde dice',
  'que versiculo',
  'qué versículo',
  'en que parte',
  'en qué parte',
  'cita bíblica',
  'cita biblica',
  'concordancia',
  'busca versiculos',
  'busca versículos',
  'buscar texto',
  'texto biblico',
  'texto bíblico',
  'que dice en',
  'qué dice en',
  'lee el versiculo',
  'lee el versículo',
  'muestrame el capitulo',
  'muéstrame el capítulo',
];

// Patrones de creador de estudio / homilética / exégesis
const STUDY_KEYWORDS = [
  'estudiar',
  'estudio',
  'estudio biblico',
  'estudio bíblico',
  'estudio tematico',
  'estudio temático',
  'estudio inductivo',
  'bosquejo',
  'sermon',
  'sermón',
  'predica',
  'prédica',
  'libro de',
  'recomiendas',
  'recomiendame',
  'recomiéndame',
  'de que trata',
  'de qué trata',
  'como estudiar',
  'cómo estudiar',
  'guia de estudio',
  'guía de estudio',
  'plan de lectura',
  'panorama',
  'introduccion',
  'introducción',
  'resumen',
  'leccion',
  'lección',
  'enseñanza',
  'explicame',
  'explícame',
  'analisis exegetico',
  'análisis exegético',
  'exegesis',
  'exégesis',
  'hermeneutica',
  'hermenéutica',
  'leccion de escuela dominical',
  'lección dominical',
  'resumen capitular',
  'contexto historico',
  'contexto histórico',
  'doctrina de',
  'desarrolla un tema',
  'crear un estudio',
  'diseña una enseñanza',
  'quiasmo',
  'estructura literaria',
];

// Detección de los 7 Formatos Ministeriales
const SERMON_CULTO_KEYWORDS = [
  'dar un culto',
  'para un culto',
  'dar el culto',
  'en el culto',
  'predicar',
  'sermon',
  'sermón',
  'mensaje para el domingo',
  'mensaje del domingo',
  'para el domingo',
  'predica',
  'prédica',
  'pulpito',
  'púlpito',
  'ministrar en la iglesia',
  'predicacion',
  'predicación',
  'bosquejo homiletico',
  'bosquejo homilético',
];

const ESTUDIO_CLASE_KEYWORDS = [
  'clase',
  'escuela dominical',
  'estudio biblico profundo',
  'estudio bíblico profundo',
  'exegesis',
  'exégesis',
  'enseñanza para maestros',
  'instituto biblico',
  'instituto bíblico',
  'leccion biblica',
  'lección bíblica',
  'leccion dominical',
  'lección dominical',
  'estudio inductivo',
  'clase biblica',
  'clase bíblica',
];

const CELULA_JOVENES_KEYWORDS = [
  'celula',
  'célula',
  'grupo de jovenes',
  'grupo de jóvenes',
  'grupo pequeño',
  'grupo de hogar',
  'reunion de jovenes',
  'reunión de jóvenes',
  'dinamica',
  'dinámica',
  'casa de paz',
  'red de jovenes',
  'red de jóvenes',
  'jovenes',
  'jóvenes',
];

const SERIE_CAMPANA_KEYWORDS = [
  'serie',
  'campaña',
  'campana',
  '4 semanas',
  'cuatro semanas',
  'mes de',
  'plan de 4',
  'serie de sermones',
  'serie de predicas',
  'serie de prédicas',
  'serie de estudios',
  'curriculo',
  'currículo',
];

const PERFIL_PERSONAJE_KEYWORDS = [
  'vida de',
  'biografia',
  'biografía',
  'personaje',
  'perfil biblico',
  'perfil bíblico',
  'lecciones de la vida de',
  'quien fue',
  'quién fue',
  'historia de',
];

const DOCTRINA_SISTEMATICA_KEYWORDS = [
  'doctrina',
  'teologia de',
  'teología de',
  'apologetica',
  'apologética',
  'por que creemos',
  'por qué creemos',
  'fundamento de',
  'dogma',
  'sistematica',
  'sistemática',
  'defensa de la fe',
];

const CEREMONIA_ESPECIAL_KEYWORDS = [
  'boda',
  'matrimonio',
  'funeral',
  'sepelio',
  'santa cena',
  'comunion',
  'comunión',
  'bautismo',
  'bautismos',
  'presentacion de niños',
  'presentación de niños',
  'quinceañera',
  'quinceanera',
];

const CONSEJERIA_KEYWORDS = [
  'consejo',
  'oracion',
  'oración',
  'angustia',
  'me siento',
  'ayudame',
  'ayúdame',
  'depresion',
  'depresión',
  'desanimo',
  'desánimo',
  'tristeza',
  'soledad',
  'no doy mas',
  'no doy más',
  'estoy triste',
  'ansiedad',
  'desesperado',
  'desesperada',
];

/**
 * Clasifica de forma ordinaria el Formato Ministerial solicitado
 */
export function classifyMinistryFormat(text: string): MinistryFormat {
  const lower = text.toLowerCase();

  // Comprobar ceremonias especiales
  for (const kw of CEREMONIA_ESPECIAL_KEYWORDS) {
    if (lower.includes(kw)) return 'CEREMONIA_ESPECIAL';
  }

  // Comprobar serie / campaña de 4 semanas
  for (const kw of SERIE_CAMPANA_KEYWORDS) {
    if (lower.includes(kw)) return 'SERIE_CAMPANA';
  }

  // Comprobar célula / jóvenes
  for (const kw of CELULA_JOVENES_KEYWORDS) {
    if (lower.includes(kw)) return 'CELULA_JOVENES';
  }

  // Comprobar perfil biográfico de personaje
  for (const kw of PERFIL_PERSONAJE_KEYWORDS) {
    if (lower.includes(kw)) return 'PERFIL_PERSONAJE';
  }

  // Comprobar doctrina sistemática / apologética
  for (const kw of DOCTRINA_SISTEMATICA_KEYWORDS) {
    if (lower.includes(kw)) return 'DOCTRINA_SISTEMATICA';
  }

  // Comprobar sermón de culto / púlpito
  for (const kw of SERMON_CULTO_KEYWORDS) {
    if (lower.includes(kw)) return 'SERMON_CULTO';
  }

  // Comprobar escuela dominical / clase profunda
  for (const kw of ESTUDIO_CLASE_KEYWORDS) {
    if (lower.includes(kw)) return 'ESTUDIO_CLASE';
  }

  // Comprobar consejería pastoral / diálogo
  for (const kw of CONSEJERIA_KEYWORDS) {
    if (lower.includes(kw)) return 'CONSEJERIA_DIALOGO';
  }

  return 'AUTO';
}

// Indicadores de Nivel Maestro (técnico, raíces, lenguas originales, crítica textual)
const MAESTRO_KEYWORDS = [
  'strong',
  'hebreo',
  'griego',
  'arameo',
  'koine',
  'koiné',
  'lxx',
  'septuaginta',
  'textus receptus',
  'masoretico',
  'masorético',
  'hapax',
  'morfologia',
  'morfología',
  'sintaxis',
  'variante textual',
  'quiasmo',
  'exégesis',
  'exegetico',
  'exegético',
  'intertextualidad',
  'pacto sinaitico',
  'pacto abrahamico',
  'escatologia preterista',
  'amilenarismo',
  'dispensacionalismo',
  'hipostatica',
  'pericope',
  'perícopa',
];

// Indicadores de Nivel Discípulo (intermedio, teología sistemática, histórico)
const DISCIPULO_KEYWORDS = [
  'contexto',
  'antiguo testamento',
  'nuevo testamento',
  'epistola',
  'epístola',
  'pablo',
  'apostol',
  'apóstol',
  'sinopticos',
  'sinópticos',
  'pacto',
  'gracia',
  'justificacion',
  'justificación',
  'santificacion',
  'santificación',
  'redencion',
  'redención',
  'propiciacion',
  'propiciación',
  'autor',
  'fecha',
  'destinatarios',
  'iglesia primitiva',
  'teologia',
  'teología',
  'discipulado',
  'evangelismo',
];

/**
 * Clasifica la ruta de intención teológica
 */
export function classifyRoute(text: string): TheologicalRoute {
  const lower = text.toLowerCase();
  const format = classifyMinistryFormat(text);

  // 1. Formatos de consejería pastoral directa
  if (format === 'CONSEJERIA_DIALOGO') {
    return '[CHARLA_CONSEJERIA]';
  }

  // 2. Si se solicitó explícitamente cualquiera de los 7 formatos homiléticos / de enseñanza
  if (format !== 'AUTO') {
    return '[CREADOR_ESTUDIO]';
  }

  // 3. Citas bíblicas explícitas (ej: Juan 3:16) o códigos Strong (ej: H1254) sin petición de bosquejo
  const isExplicitCitation = STRONG_CODE_REGEX.test(text) || VERSE_CITATION_REGEX.test(text);
  const isExplicitStudyRequest = [
    'bosquejo',
    'sermon',
    'sermón',
    'predica',
    'prédica',
    'estudio inductivo',
    'crear un estudio',
    'diseña una enseñanza',
  ].some((k) => lower.includes(k));

  if (isExplicitCitation && !isExplicitStudyRequest) {
    return '[BUSQUEDA_EXACTA]';
  }

  // 4. Palabras clave de búsqueda exacta ("dónde dice", "texto bíblico", etc.)
  for (const kw of EXACT_SEARCH_KEYWORDS) {
    if (lower.includes(kw)) {
      return '[BUSQUEDA_EXACTA]';
    }
  }

  // 5. Creador de estudio / homilética / análisis temático
  for (const kw of STUDY_KEYWORDS) {
    if (lower.includes(kw)) {
      return '[CREADOR_ESTUDIO]';
    }
  }

  // Detección canónica universal de cualquiera de los 66 libros bíblicos
  const detectedBook = findCanonicalBook(text);
  if (detectedBook) {
    return '[CREADOR_ESTUDIO]';
  }

  // 6. Por defecto, conversación pastoral y consejería
  return '[CHARLA_CONSEJERIA]';
}

/**
 * Clasifica el nivel teológico sugerido según el vocabulario de entrada
 */
export function classifyLevel(text: string): UserTheologicalLevel {
  const lower = text.toLowerCase();

  // 1. Comprobar Nivel Maestro
  if (STRONG_CODE_REGEX.test(text)) {
    return 'Maestro';
  }

  for (const kw of MAESTRO_KEYWORDS) {
    if (lower.includes(kw)) {
      return 'Maestro';
    }
  }

  // 2. Comprobar Nivel Discípulo
  for (const kw of DISCIPULO_KEYWORDS) {
    if (lower.includes(kw)) {
      return 'Discipulo';
    }
  }

  // 3. Por defecto, Semilla (lenguaje accesible, cotidiano, pastoral)
  return 'Semilla';
}
