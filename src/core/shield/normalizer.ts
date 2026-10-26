/**
 * Normalizador Lingüístico y de Dialectos - Escudo Determinista
 * Latencia esperada: < 2 ms | Memoria: < 150 KB
 * Traduce abreviaturas de mensajería, jerga regional hispanoamericana y faltas ortográficas
 * hacia un español neutro apto para consultas teológicas y el motor de inferencia local.
 */

// 1. Diccionario de abreviaturas de chat y mensajería
const CHAT_ABBREVIATIONS: Record<string, string> = {
  xq: 'por qué',
  pq: 'por qué',
  pk: 'por qué',
  q: 'que',
  k: 'que',
  pa: 'para',
  tb: 'también',
  tmb: 'también',
  tbn: 'también',
  d: 'de',
  toy: 'estoy',
  tas: 'estás',
  tamo: 'estamos',
  pls: 'por favor',
  plz: 'por favor',
  porfa: 'por favor',
  xfa: 'por favor',
  bn: 'bien',
  vda: 'vida',
  klk: 'qué tal',
  dm: 'mensaje directo',
  ntp: 'no te preocupes',
  vdd: 'verdad',
  msj: 'mensaje',
  grax: 'gracias',
  mxo: 'mucho',
  muxo: 'mucho',
  apocali: 'apocalipsis',
  salm: 'salmos',
  prov: 'proverbios',
  mnt: 'minuto',
  tpo: 'tiempo',
};

// 2. Modismos regionales latinoamericanos -> Español neutro
const REGIONAL_IDIOMS: Record<string, string> = {
  // Trabajo
  chamba: 'trabajo',
  chambear: 'trabajar',
  laburo: 'trabajo',
  laburar: 'trabajar',
  pega: 'trabajo',
  camello: 'trabajo',
  camellar: 'trabajar',

  // Amigo / Prójimo
  pana: 'amigo',
  parcero: 'amigo',
  parce: 'amigo',
  chamo: 'amigo',
  cuate: 'amigo',
  pibe: 'joven',
  chaval: 'joven',
  bro: 'hermano',
  carnal: 'hermano',
  compadre: 'amigo',
  valedor: 'amigo',

  // Dinero / Finanzas
  plata: 'dinero',
  lana: 'dinero',
  guita: 'dinero',
  varo: 'dinero',
  lucas: 'dinero',
  morlacos: 'dinero',

  // Estado anímico / Emocional
  bajon: 'desánimo',
  bajón: 'desánimo',
  aguite: 'tristeza',
  agüite: 'tristeza',
  achicopalado: 'desanimado',
  achicopalada: 'desanimada',
  desparchado: 'sin rumbo',
  depre: 'depresión',
  rayado: 'confundido',
  rayada: 'confundida',

  // Ira / Enojo
  arrecho: 'enojado',
  arrecha: 'enojada',
  emputado: 'muy enojado',
  emputada: 'muy enojada',
  encabronado: 'muy enojado',
  encabronada: 'muy enojada',
  bravo: 'enojado',
  brava: 'enojada',
  picao: 'resentido',
  picado: 'resentido',

  // Objetos / Asuntos
  vaina: 'asunto',
  vainas: 'asuntos',
  broma: 'cosa',
  volada: 'asunto',

  // Sustancias / Vicios
  chela: 'bebida alcohólica',
  chelas: 'bebidas alcohólicas',
  pola: 'bebida alcohólica',
  polas: 'bebidas alcohólicas',
  birra: 'bebida alcohólica',
  birras: 'bebidas alcohólicas',
  trago: 'bebida alcohólica',
  pomo: 'botella de alcohol',
  chupadera: 'embriaguez',
};

// 3. Faltas ortográficas bíblicas / teológicas frecuentes
const THEOLOGICAL_MISSPELLINGS: Record<string, string> = {
  diosito: 'Dios',
  papadios: 'Dios Padre',
  jesus: 'Jesús',
  jesucristo: 'Jesucristo',
  jehova: 'Jehová',
  yahve: 'Yahvé',
  yahveh: 'Yahvé',
  espiritu: 'Espíritu',
  'espiritu santo': 'Espíritu Santo',
  oracion: 'oración',
  bendision: 'bendición',
  bendisiones: 'bendiciones',
  perdon: 'perdón',
  salvasion: 'salvación',
  pecao: 'pecado',
  jenesis: 'Génesis',
  genesis: 'Génesis',
  exodo: 'Éxodo',
  levitico: 'Levítico',
  apocalisi: 'Apocalipsis',
  apocalipsis: 'Apocalipsis',
  isaias: 'Isaías',
  jeremias: 'Jeremías',
  mateo: 'Mateo',
  marcos: 'Marcos',
  lucas: 'Lucas',
  juan: 'Juan',
  hechos: 'Hechos',
  romanos: 'Romanos',
  corintios: 'Corintios',
  galatas: 'Gálatas',
  efesios: 'Efesios',
  filipenses: 'Filipenses',
  colosenses: 'Colosenses',
  tesalonicenses: 'Tesalonicenses',
  timoteo: 'Timoteo',
  hebreos: 'Hebreos',
  santiago: 'Santiago',
  pedro: 'Pedro',
  apocaleipsis: 'Apocalipsis',
  fe: 'fe',
};

// Mapeo fonético para abreviaturas de libros bíblicos comunes
const BOOK_ABBREVIATIONS: Record<string, string> = {
  gn: 'Génesis',
  gen: 'Génesis',
  ex: 'Éxodo',
  exo: 'Éxodo',
  lv: 'Levítico',
  lev: 'Levítico',
  nm: 'Números',
  num: 'Números',
  dt: 'Deuteronomio',
  deut: 'Deuteronomio',
  jos: 'Josué',
  sal: 'Salmos',
  salm: 'Salmos',
  pr: 'Proverbios',
  prov: 'Proverbios',
  is: 'Isaías',
  isa: 'Isaías',
  jr: 'Jeremías',
  jer: 'Jeremías',
  mt: 'Mateo',
  mat: 'Mateo',
  mr: 'Marcos',
  mc: 'Marcos',
  lc: 'Lucas',
  luc: 'Lucas',
  jn: 'Juan',
  hch: 'Hechos',
  ro: 'Romanos',
  rom: 'Romanos',
  '1co': '1 Corintios',
  '2co': '2 Corintios',
  gl: 'Gálatas',
  gal: 'Gálatas',
  ef: 'Efesios',
  flp: 'Filipenses',
  col: 'Colosenses',
  hb: 'Hebreos',
  heb: 'Hebreos',
  stg: 'Santiago',
  '1p': '1 Pedro',
  '2p': '2 Pedro',
  '1jn': '1 Juan',
  ap: 'Apocalipsis',
  apoc: 'Apocalipsis',
};

/**
 * Normaliza el texto de entrada:
 * 1. Limpieza de caracteres repetidos excesivos (ej: "holaaaaa" -> "hola", "por favorrrr" -> "por favor")
 * 2. Sustitución de abreviaturas de chat
 * 3. Traducción de modismos regionales a español neutro
 * 4. Corrección de faltas ortográficas teológicas críticas
 * 5. Expansión de referencias abreviadas (ej: "jn 3:16" -> "Juan 3:16")
 */
export function normalizeLinguisticDialect(input: string): string {
  if (!input || input.trim() === '') return '';

  let text = input.trim();

  // 1. Reducir repetición excesiva de letras (3 o más repeticiones consecutivas a 1 o 2)
  text = text.replace(/([a-zA-ZáéíóúñÁÉÍÓÚÑ])\1{2,}/g, '$1');

  // 2. Separar referencias como "1co" o "jn3:16" -> "1co", "jn 3:16"
  text = text.replace(/(\b[0-9]?[a-zA-Z]{2,4})(\d+[:.])/gi, '$1 $2');

  // 3. Sustitución de frases teológicas compuestas prioritarias antes de tokenizar
  text = text.replace(/\besp[ií]ritu\s+santo\b/gi, 'Espíritu Santo');
  text = text.replace(/\bdios\s+padre\b/gi, 'Dios Padre');
  text = text.replace(/\bnuevo\s+testamento\b/gi, 'Nuevo Testamento');
  text = text.replace(/\bantiguo\s+testamento\b/gi, 'Antiguo Testamento');

  // 4. Tokenización preservando signos de puntuación estructurales
  const words = text.split(/(\s+|[,;.¿?¡!():"])/);

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    if (!rawWord || /^\s+$/.test(rawWord) || /^[,;.¿?¡!():"]+$/.test(rawWord)) {
      continue;
    }

    const cleanLower = rawWord.toLowerCase();

    // Comprobar abreviatura bíblica
    if (BOOK_ABBREVIATIONS[cleanLower]) {
      words[i] = BOOK_ABBREVIATIONS[cleanLower];
      continue;
    }

    // Comprobar abreviaturas de chat
    if (CHAT_ABBREVIATIONS[cleanLower]) {
      words[i] = CHAT_ABBREVIATIONS[cleanLower];
      continue;
    }

    // Comprobar modismos regionales
    if (REGIONAL_IDIOMS[cleanLower]) {
      words[i] = REGIONAL_IDIOMS[cleanLower];
      continue;
    }

    // Comprobar faltas teológicas
    if (THEOLOGICAL_MISSPELLINGS[cleanLower]) {
      words[i] = THEOLOGICAL_MISSPELLINGS[cleanLower];
      continue;
    }
  }

  let normalized = words.join('');

  // 5. Normalizar formato canónico de citas (ej: "Juan 3.16" -> "Juan 3:16")
  normalized = normalized.replace(/([A-ZÁÉÍÓÚ][a-záéíóúñ]+)\s+(\d+)\.(\d+)/g, '$1 $2:$3');

  return normalized;
}
