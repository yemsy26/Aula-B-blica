import { TheologicalTheme, SemanticRewriteResult } from './types.js';
import { findCanonicalBook } from '../database/canonicalBooks.js';
import { mapCasuistryContext } from './casuistryMapper.js';

export const THEOLOGICAL_THEMES: TheologicalTheme[] = [
  {
    id: 'ansiedad_miedo_paz',
    nombre: 'Paz, Confianza y Victoria sobre la Ansiedad',
    conceptosClave: ['paz', 'confianza', 'soberanía', 'reposo', 'amparo', 'fortaleza'],
    terminosHumanos: [
      'miedo',
      'temor',
      'ansiedad',
      'angustia',
      'panico',
      'preocupacion',
      'no puedo dormir',
      'estres',
      'desesperacion',
      'asustado',
      'asustada',
    ],
    librosRecomendados: ['Salmos', 'Filipenses', 'Isaías', 'Mateo'],
    codigosStrongRecomendados: ['H7965', 'G4102'], // Shalom, Pistis
    versiculosClave: [
      // Paz propiamente dicha: el tema debe apuntar a los textos que hablan
      // de paz, no sólo a promesas generales de consuelo.
      { libro: 'Filipenses', capitulo: 4, versiculo: 6 },
      { libro: 'Filipenses', capitulo: 4, versiculo: 7 },
      { libro: 'Romanos', capitulo: 5, versiculo: 1 },
      { libro: 'Hebreos', capitulo: 13, versiculo: 20 },
      { libro: 'Salmos', capitulo: 23, versiculo: 4 },
      { libro: 'Isaías', capitulo: 41, versiculo: 10 },
      { libro: 'Mateo', capitulo: 11, versiculo: 28 },
    ],
  },
  {
    id: 'finanzas_providencia_trabajo',
    nombre: 'Providencia Divina, Trabajo y Seguridad Material',
    conceptosClave: ['providencia', 'sustento', 'fidelidad', 'mayordomía', 'reposo'],
    terminosHumanos: [
      'dinero',
      'trabajo',
      'chamba',
      'deudas',
      'quiebra',
      'pobreza',
      'sin un centavo',
      'desempleo',
      'no me alcanza',
      'escasez',
    ],
    librosRecomendados: ['Mateo', 'Filipenses', 'Proverbios', 'Salmos'],
    codigosStrongRecomendados: ['H3068'],
    versiculosClave: [
      { libro: 'Proverbios', capitulo: 3, versiculo: 5 },
      { libro: 'Salmos', capitulo: 23, versiculo: 1 },
      { libro: 'Filipenses', capitulo: 4, versiculo: 13 },
    ],
  },
  {
    id: 'tristeza_duelo_consuelo',
    nombre: 'Consuelo Divino, Esperanza en el Quebranto y Sanidad Emocional',
    conceptosClave: ['consuelo', 'esperanza', 'cercanía', 'compasión', 'restauración'],
    terminosHumanos: [
      'tristeza',
      'duelo',
      'luto',
      'llanto',
      'depresion',
      'desanimo',
      'soledad',
      'vacio',
      'corazon roto',
      'quebrantado',
    ],
    librosRecomendados: ['Salmos', 'Jeremías', 'Apocalipsis', 'Juan'],
    codigosStrongRecomendados: ['G26'], // Agape
    versiculosClave: [
      { libro: 'Salmos', capitulo: 34, versiculo: 18 },
      { libro: 'Jeremías', capitulo: 29, versiculo: 11 },
      { libro: 'Apocalipsis', capitulo: 21, versiculo: 4 },
    ],
  },
  {
    id: 'culpa_perdon_gracia',
    nombre: 'Gracia Justificadora, Redención y Absolución de Culpa',
    conceptosClave: ['gracia', 'justificación', 'perdón', 'redención', 'propiciación'],
    terminosHumanos: [
      'culpa',
      'remordimiento',
      'peque',
      'pecado',
      'dios me condena',
      'no merezco perdon',
      'arrepentimiento',
      'limpieza',
      'inmundo',
    ],
    librosRecomendados: ['Romanos', 'Efesios', '1 Juan', 'Juan'],
    codigosStrongRecomendados: ['G5485', 'G26'], // Charis, Agape
    versiculosClave: [
      { libro: 'Juan', capitulo: 3, versiculo: 16 },
      { libro: 'Romanos', capitulo: 3, versiculo: 23 },
      { libro: 'Romanos', capitulo: 8, versiculo: 28 },
      { libro: 'Efesios', capitulo: 2, versiculo: 8 },
    ],
  },
  {
    id: 'proposito_vocacion_soberania',
    nombre: 'Propósito Eterno, Vocación y Voluntad Soberana',
    conceptosClave: ['propósito', 'voluntad', 'llamado', 'soberanía', 'futuro'],
    terminosHumanos: [
      'proposito',
      'para que naci',
      'no se que hacer',
      'sentido de la vida',
      'futuro',
      'destino',
      'voluntad de dios',
      'rumbo',
    ],
    librosRecomendados: ['Jeremías', 'Romanos', 'Proverbios', 'Efesios'],
    codigosStrongRecomendados: ['H7225', 'G3056'],
    versiculosClave: [
      { libro: 'Jeremías', capitulo: 29, versiculo: 11 },
      { libro: 'Romanos', capitulo: 8, versiculo: 28 },
      { libro: 'Proverbios', capitulo: 3, versiculo: 6 },
    ],
  },
  {
    id: 'creacion_origenes_logos',
    nombre: 'Cosmología Bíblica, Creación Ex Nihilo y Cristo como Verbo',
    conceptosClave: ['creación', 'logos', 'origen', 'principio', 'poder creador'],
    terminosHumanos: [
      'creacion',
      'crear',
      'origen del mundo',
      'universo',
      'big bang',
      'como creo dios',
      'bara',
      'genesis',
    ],
    librosRecomendados: ['Génesis', 'Juan', 'Hebreos'],
    codigosStrongRecomendados: ['H1254', 'H7225', 'G3056'],
    versiculosClave: [
      { libro: 'Génesis', capitulo: 1, versiculo: 1 },
      { libro: 'Génesis', capitulo: 1, versiculo: 2 },
      { libro: 'Génesis', capitulo: 1, versiculo: 3 },
      { libro: 'Juan', capitulo: 1, versiculo: 1 },
      { libro: 'Juan', capitulo: 1, versiculo: 14 },
    ],
  },
  {
    id: 'evangelios_reino_mateo',
    nombre: 'El Evangelio del Reino, el Rey Mesías y el Discipulado en Mateo',
    conceptosClave: ['reino de dios', 'mesías', 'discipulado', 'sermón del monte', 'bienaventuranzas', 'gran comisión'],
    terminosHumanos: [
      'mateo',
      'evangelio de mateo',
      'libro de mateo',
      'el reino de los cielos',
      'bienaventurados',
      'sermon del monte',
      'gran comision',
      'seguir a jesus',
      'discipulo de jesus',
      'parabolas del reino',
    ],
    librosRecomendados: ['Mateo', 'Marcos', 'Lucas', 'Juan'],
    codigosStrongRecomendados: ['G932', 'G3101'], // Basileia (Reino), Mathetes (Discípulo)
    versiculosClave: [
      { libro: 'Mateo', capitulo: 6, versiculo: 33 },
      { libro: 'Mateo', capitulo: 11, versiculo: 28 },
    ],
  },
];

function normalizeSimple(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Reescritor de Intención Teológica:
 * Mapea problemas humanos cotidianos hacia conceptos doctrinales, libros y raíces antes de tocar SQLite.
 */
export function rewriteTheologicalIntent(
  rawQuery: string,
  normalizedQuery: string
): SemanticRewriteResult {
  const queryClean = normalizeSimple(normalizedQuery);
  const detectedThemeIds = new Set<string>();
  const suggestedBooks = new Set<string>();
  const suggestedStrong = new Set<string>();
  const searchKeywords = new Set<string>();

  // 1. Evaluación por temas teológicos
  for (const theme of THEOLOGICAL_THEMES) {
    let matched = false;

    for (const humanTerm of theme.terminosHumanos) {
      if (queryClean.includes(normalizeSimple(humanTerm))) {
        matched = true;
        searchKeywords.add(humanTerm);
      }
    }

    for (const concept of theme.conceptosClave) {
      if (queryClean.includes(normalizeSimple(concept))) {
        matched = true;
        searchKeywords.add(concept);
      }
    }

    if (matched) {
      detectedThemeIds.add(theme.nombre);
      theme.librosRecomendados.forEach((b) => suggestedBooks.add(b));
      theme.codigosStrongRecomendados.forEach((s) => suggestedStrong.add(s));
      theme.conceptosClave.slice(0, 3).forEach((c) => searchKeywords.add(c));
    }
  }

  // 2. Extraer palabras clave sustantivas de la consulta si no hubo match amplio
  const words = normalizedQuery
    .split(/\s+/)
    .map((w) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ''))
    .filter((w) => w.length > 3 && !['para', 'como', 'porque', 'pero', 'sobre', 'cuando', 'donde'].includes(w.toLowerCase()));

  words.forEach((w) => searchKeywords.add(w));

  // 3. Detección canónica universal de cualquiera de los 66 libros
  const detectedBook = findCanonicalBook(rawQuery) || findCanonicalBook(normalizedQuery);
  if (detectedBook) {
    suggestedBooks.add(detectedBook.nombre);
    searchKeywords.add(detectedBook.nombre);
    detectedThemeIds.add(`${detectedBook.nombre}: ${detectedBook.temaCentral}`);
    detectedBook.seccionesPrincipales.forEach((s) => searchKeywords.add(s));
  }

  // 4. Mapeo de Casuística y Arquetipos Espejo Bíblicos
  const casuistry = mapCasuistryContext(rawQuery + ' ' + normalizedQuery);
  if (casuistry.mirror) {
    detectedThemeIds.add(`Espejo Bíblico: ${casuistry.mirror.personaje}`);
    casuistry.suggestedBooks.forEach((b) => suggestedBooks.add(b));
    casuistry.searchKeywords.forEach((k) => searchKeywords.add(k));
  }

  return {
    queryOriginal: rawQuery,
    queryNormalizada: normalizedQuery,
    temasDetectados: Array.from(detectedThemeIds),
    librosSugeridos: Array.from(suggestedBooks),
    codigosStrongSugeridos: Array.from(suggestedStrong),
    terminosBusqueda: Array.from(searchKeywords),
  };
}
