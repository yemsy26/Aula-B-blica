export type CasuistryCategory =
  | 'ECONOMIA_DEUDAS'
  | 'AGOTAMIENTO_DEPRESION'
  | 'ANSIEDAD_FUTURO'
  | 'RELACIONES_TRAICION'
  | 'CULPA_PERDON'
  | 'LIDERAZGO_CARGA'
  | 'DOLOR_SUFRIMIENTO'
  | 'DUDA_VOCACION';

export interface BiblicalMirror {
  id: string;
  categoria: CasuistryCategory;
  titulo: string;
  situacionesHumanas: string[];
  personaje: string;
  referenciaBiblica: string;
  libroPrincipal: string;
  versiculosClave: string[];
  historiaEspejo: string;
  principioCentral: string;
  aplicacionPractica: string[];
  preguntaPingPong: string;
}

/**
 * Catálogo Canónico de Espejos Bíblicos:
 * Mapea problemas humanos reales a relatos, personajes y soluciones canónicas exactas.
 */
export const BIBLICAL_MIRRORS: BiblicalMirror[] = [
  {
    id: 'espejo_deudas_viuda_eliseo',
    categoria: 'ECONOMIA_DEUDAS',
    titulo: 'Mayordomía de Crisis y Provisión Divina en la Escasez',
    situacionesHumanas: [
      'deuda',
      'deudas',
      'dinero',
      'sin dinero',
      'sin plata',
      'plata',
      'chamba',
      'desempleo',
      'quiebra',
      'bancarrota',
      'no me alcanza',
      'no llego a fin de mes',
      'acreedor',
      'acreedores',
      'escasez',
      'crisis financiera',
      'embargo',
      'prestamo',
      'préstamo',
    ],
    personaje: 'La viuda endeudada y el profeta Eliseo',
    referenciaBiblica: '2 Reyes 4:1-7',
    libroPrincipal: '2 Reyes',
    versiculosClave: ['2 Reyes 4:2', '2 Reyes 4:7', 'Lucas 14:28'],
    historiaEspejo:
      'La viuda tenía a los acreedores golpeando la puerta para llevarse a sus dos hijos como siervos por una deuda que parecía imposible de pagar. ' +
      'Desesperada, sintió que no le quedaba absolutamente nada de valor en la vida, excepto una pequeña botija de aceite arrinconada en su casa.',
    principioCentral:
      'Dios nunca inicia su provisión en lo que te falta, sino en lo que ya tienes en tus manos cuando lo consagras en obediencia. ' +
      'El aceite no dejó de fluir mientras hubo vasijas vacías dispuestas a recibirlo.',
    aplicacionPractica: [
      'Haz un inventario honesto: identifica qué habilidades, recursos mínimos o dones tienes a mano hoy, en vez de angustiarte por lo que no posees.',
      'Busca vasijas prestadas: acércate a tu comunidad de fe y consejeros de confianza; no te aísles en la vergüenza de la escasez.',
      'Paga primero y administra el resto: Eliseo ordenó vender el aceite, honrar a los acreedores con integridad y vivir sobriamente de lo que quedara.',
    ],
    preguntaPingPong:
      '¿En este momento la mayor carga viene por deudas urgentes que pagar o por la falta de un ingreso constante para el sustento diario?',
  },
  {
    id: 'espejo_agotamiento_elias',
    categoria: 'AGOTAMIENTO_DEPRESION',
    titulo: 'Renovación Compasiva en el Desierto del Agotamiento',
    situacionesHumanas: [
      'agotamiento',
      'agotado',
      'agotada',
      'cansado',
      'cansada',
      'depresion',
      'depresión',
      'deprimido',
      'deprimida',
      'no puedo mas',
      'no puedo más',
      'quiero tirar la toalla',
      'tirar la toalla',
      'rendirme',
      'sin fuerzas',
      'desanimo',
      'desánimo',
      'burnout',
      'colapso',
      'fatiga',
      'sin ganas de vivir',
    ],
    personaje: 'Elías bajo el enebro en el desierto',
    referenciaBiblica: '1 Reyes 19:1-8',
    libroPrincipal: '1 Reyes',
    versiculosClave: ['1 Reyes 19:4', '1 Reyes 19:5', 'Salmos 34:18', 'Mateo 11:28'],
    historiaEspejo:
      'Tras una agotadora batalla espiritual y huyendo de amenazas de muerte, el profeta Elías colapsó física y emocionalmente en el desierto. ' +
      'Se sentó bajo un enebro y pidió morirse diciendo: «Bástame ya, oh Jehová, quita mi alma». Había llegado a su límite humano.',
    principioCentral:
      'Dios no reprendió el quebranto ni la depresión de Elías con discursos duros; le envió un ángel con pan caliente y agua fresca, y lo mandó a dormir. ' +
      'El Señor comprende la fragilidad de nuestra vasija de barro antes de renovar nuestra vocación.',
    aplicacionPractica: [
      'Reconoce tu humanidad: descansar, comer bien y dormir no es falta de fe, es mayordomía elemental de tu cuerpo.',
      'Desahoga tu corazón sin máscaras religiosas: Dios escucha tu lamento sin juzgar tu cansancio.',
      'Aprende a escuchar el silbo apacible: la voz de Dios no suele estar en el torbellino de la prisa, sino en la quietud de la oración silenciosa.',
    ],
    preguntaPingPong:
      '¿Sientes que este agotamiento es más físico por sobrecarga de responsabilidades, o es una fatiga emocional acumulada en el alma?',
  },
  {
    id: 'espejo_ansiedad_futuro_jesus',
    categoria: 'ANSIEDAD_FUTURO',
    titulo: 'Descanso en la Providencia frente a la Incertidumbre',
    situacionesHumanas: [
      'ansiedad',
      'miedo',
      'temor',
      'panico',
      'pánico',
      'preocupacion',
      'preocupación',
      'que va a pasar',
      'qué va a pasar',
      'futuro',
      'futuro incierto',
      'no se que hacer',
      'no sé qué hacer',
      'no puedo dormir',
      'angustia',
    ],
    personaje: 'Jesús y la enseñanza de las aves y los lirios',
    referenciaBiblica: 'Mateo 6:25-34',
    libroPrincipal: 'Mateo',
    versiculosClave: ['Mateo 6:33', 'Josué 1:9', 'Filipenses 4:6-7'],
    historiaEspejo:
      'Jesús vio a una multitud asediada por impuestos, sequías e incertidumbre de sustento. ' +
      'Los detuvo y les mostró las aves del cielo y los lirios del campo, recordándoles el valor inmenso que ellos tienen para el Padre celestial.',
    principioCentral:
      'El afán del mañana no vacía el futuro de sus problemas, solo vacía el presente de sus fuerzas. ' +
      'Cada día trae su propio afán y su propia medida de gracia soberana.',
    aplicacionPractica: [
      'Acota tu horizonte mental: entrégale a Dios las próximas 24 horas y no intentes resolver el año entero hoy.',
      'Sustituye la preocupación mental por oración específica y acción de gracias (Filipenses 4:6).',
      'Busca primeramente el Reino: cuando tus prioridades están centradas en la voluntad de Dios, tus emociones encuentran reposo.',
    ],
    preguntaPingPong:
      '¿Hay una situación concreta que te esté quitando la paz hoy, o es más bien una sensación difusa sobre lo que vendrá mañana?',
  },
  {
    id: 'espejo_relaciones_jose_hermanos',
    categoria: 'RELACIONES_TRAICION',
    titulo: 'Sanidad del Rencor y Soberanía sobre la Traición',
    situacionesHumanas: [
      'traicion',
      'traición',
      'herida',
      'me hirieron',
      'rencor',
      'no puedo perdonar',
      'perdonar',
      'ofensa',
      'enemigo',
      'enemigos',
      'rechazo',
      'engaño',
      'matrimonio roto',
      'conflicto familiar',
    ],
    personaje: 'José y el perdón transformador a sus hermanos',
    referenciaBiblica: 'Génesis 45:1-8; 50:20',
    libroPrincipal: 'Génesis',
    versiculosClave: ['Génesis 50:20', 'Efesios 4:32', 'Romanos 12:19'],
    historiaEspejo:
      'José fue arrojado a un pozo y vendido como esclavo por sus propios hermanos de sangre. ' +
      'Años más tarde, con todo el poder del imperio egipcio para vengarse, decidió llorar, perdonar y afirmar: «Vosotros pensasteis mal sobre mí, mas Dios lo encaminó á bien».',
    principioCentral:
      'El perdón no justifica la injusticia del ofensor, pero te libera de la cárcel de la amargura. ' +
      'Dios es capaz de transformar las heridas más dolorosas en plataformas de propósito y misericordia.',
    aplicacionPractica: [
      'Renuncia a tomar venganza: deja el juicio en manos del Dios justo y soberano.',
      'Distingue entre perdonar y confiar de inmediato: el perdón es una decisión voluntaria; la confianza es un puente que se reconstruye con hechos.',
      'Ora por quien te lastimó: pedir la gracia de Dios para otros es el bálsamo que cicatriza tu propio corazón.',
    ],
    preguntaPingPong:
      '¿Sientes que esta herida es muy reciente y aún te duele hablar de ella, o es algo del pasado que sigue pesando en tu presente?',
  },
  {
    id: 'espejo_culpa_pedro_restaurado',
    categoria: 'CULPA_PERDON',
    titulo: 'Absolución de Culpa y Restauración del Llamado',
    situacionesHumanas: [
      'culpa',
      'remordimiento',
      'peque',
      'pequé',
      'fallé',
      'le falle a dios',
      'le fallé a dios',
      'no merezco',
      'arrepentimiento',
      'condenacion',
      'condenación',
      'indigno',
      'indigna',
    ],
    personaje: 'Pedro restaurado junto a las brasas por Jesús',
    referenciaBiblica: 'Juan 21:15-19',
    libroPrincipal: 'Juan',
    versiculosClave: ['Juan 21:17', '1 Juan 1:9', 'Romanos 8:1'],
    historiaEspejo:
      'Pedro había jurado que jamás abandonaría a Jesús, pero terminó negándolo tres veces en la noche del juicio. ' +
      'Avergonzado y quebrado por su fracaso, volvió a pescar sintiéndose descalificado. Jesús lo esperó en la orilla con un fuego de brasas para recordarle su amor y encomendarle Su rebaño.',
    principioCentral:
      'El adversario usa tu pecado para convencerte de que estás descartado para siempre; ' +
      'Cristo usa tu arrepentimiento sincero para vaciarte de autosuficiencia y formarte en un siervo más tierno y compasivo.',
    aplicacionPractica: [
      'Confiesa tu falta sin excusas: «Si confesamos nuestros pecados, él es fiel y justo para perdonar» (1 Jn 1:9).',
      'Recibe la justificación por gracia: tu perdón descansa en el sacrificio perfecto de la cruz, no en tu capacidad de castigarte a ti mismo.',
      'Levántate y persevera: tu dolor perdonado será testimonio para consolar a otros que caigan.',
    ],
    preguntaPingPong:
      '¿Te cuesta creer que Dios verdaderamente te ha perdonado, o eres tú mismo(a) quien no logra soltar el reproche por lo sucedido?',
  },
  {
    id: 'espejo_liderazgo_moises_jetro',
    categoria: 'LIDERAZGO_CARGA',
    titulo: 'Delegación Humilde y Sabiduría en la Carga Ministerial',
    situacionesHumanas: [
      'liderazgo',
      'pastor',
      'pastoreo',
      'mucha responsabilidad',
      'sobrecargado',
      'solo en el ministerio',
      'no doy abasto',
      'demasiado trabajo',
      'ministerio',
      'servicio',
    ],
    personaje: 'Moisés y el consejo sabio de Jetro',
    referenciaBiblica: 'Éxodo 18:13-24',
    libroPrincipal: 'Éxodo',
    versiculosClave: ['Éxodo 18:18', 'Gálatas 6:2', '2 Timoteo 2:2'],
    historiaEspejo:
      'Moisés se sentaba desde la mañana hasta el atardecer a juzgar cada pleito de Israel. ' +
      'Su suegro Jetro lo observó y le dijo una verdad contundente: «Desfallecerás del todo, tú y este pueblo... el trabajo es demasiado pesado para ti; no podrás hacerlo tú solo».',
    principioCentral:
      'Pretender resolverlo todo individualmente no es consagración espiritual; es falta de delegación y humildad. ' +
      'Compartir la carga forma a nuevos líderes y preserva la salud del pastor.',
    aplicacionPractica: [
      'Identifica tareas delegables y entrégalas a personas fieles y temerosas de Dios.',
      'Protege tu tiempo no negociable de oración íntima y comunión familiar.',
      'Aprende a decir un "no" sabio para salvaguardar tu llamado principal.',
    ],
    preguntaPingPong:
      '¿Qué área específica de tu servicio o trabajo sientes que te está demandando más energía de la que humanamente puedes dar?',
  },
  {
    id: 'espejo_dolor_job_redentor',
    categoria: 'DOLOR_SUFRIMIENTO',
    titulo: 'Fe Inquebrantable en el Crisol del Sufrimiento',
    situacionesHumanas: [
      'enfermedad',
      'dolor',
      'por que a mi',
      'por qué a mí',
      'injusticia',
      'prueba',
      'sufrimiento',
      'duelo',
      'luto',
      'perdida',
      'pérdida',
      'tragedia',
    ],
    personaje: 'Job en medio de la prueba y la soberanía de Dios',
    referenciaBiblica: 'Job 1-2; 42:1-6',
    libroPrincipal: 'Job',
    versiculosClave: ['Job 42:5', 'Romanos 8:28', '2 Corintios 12:9'],
    historiaEspejo:
      'Job perdió sus bienes, sus hijos y su salud de forma repentina sin causa humana aparente. ' +
      'Aun en medio del desconcierto y el silencio de Dios, perseveró hasta que su fe teórica se convirtió en visión viva: «De oídas te había oído; mas ahora mis ojos te ven».',
    principioCentral:
      'El dolor en manos de Dios no es un callejón sin salida, sino un crisol donde la fe superficial madura en intimidad profunda con el Creador.',
    aplicacionPractica: [
      'Llora y expresa tu lamento delante de Dios con sinceridad; las Escrituras validan el clamor en el quebranto.',
      'Rechaza las respuestas simplistas y confía en el carácter misericordioso de Dios aun en la penumbra.',
      'Recuerda que la última palabra sobre tu vida la tiene la fidelidad eterna del Redentor.',
    ],
    preguntaPingPong:
      'En medio de este tiempo tan difícil, ¿qué es lo que más necesitas pedirle al Señor en tu intimidad hoy?',
  },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Motor de Casuística: Encuentra el Espejo Bíblico más idóneo para la situación humana
 */
export function findBiblicalMirror(query: string): BiblicalMirror | null {
  const norm = normalizeText(query);

  let bestMatch: BiblicalMirror | null = null;
  let maxScore = 0;

  for (const mirror of BIBLICAL_MIRRORS) {
    let score = 0;

    for (const sit of mirror.situacionesHumanas) {
      const sitNorm = normalizeText(sit);
      if (norm.includes(sitNorm)) {
        // Frases más largas tienen mayor peso de correlación
        score += sitNorm.length > 5 ? 3 : 1;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = mirror;
    }
  }

  // Requiere al menos una coincidencia significativa
  return maxScore > 0 ? bestMatch : null;
}

/**
 * Mapeador Semántico de Casuística hacia el RAG
 */
export function mapCasuistryContext(query: string): {
  mirror: BiblicalMirror | null;
  suggestedBooks: string[];
  suggestedVerses: string[];
  searchKeywords: string[];
} {
  const mirror = findBiblicalMirror(query);

  if (!mirror) {
    return {
      mirror: null,
      suggestedBooks: [],
      suggestedVerses: [],
      searchKeywords: [],
    };
  }

  return {
    mirror,
    suggestedBooks: [mirror.libroPrincipal],
    suggestedVerses: mirror.versiculosClave,
    searchKeywords: [mirror.personaje, mirror.referenciaBiblica, ...mirror.situacionesHumanas.slice(0, 4)],
  };
}
