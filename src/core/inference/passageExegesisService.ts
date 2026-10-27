import { CanonicalBookProfile, findCanonicalBook } from '../database/canonicalBooks.js';
import { UserTheologicalLevel } from '../shield/types.js';

export interface ExtractedPassage {
  canonicalBook: CanonicalBookProfile;
  bookName: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
  formattedCitation: string;
  isVerseSpecific: boolean;
  isChapterSpecific: boolean;
}

export interface LexicalEntry {
  originalWord: string;
  transliteration: string;
  strongCode?: string;
  language: 'Hebreo' | 'Griego' | 'Arameo';
  literalMeaning: string;
  theologicalDefinition: string;
  misconceptionsToAvoid: string;
}

/**
 * Catálogo exegético de alta precisión léxica para los pasajes más consultados de las Escrituras.
 * Define términos originales en Hebreo/Griego y desmonta alucinaciones o interpretaciones erróneas.
 */
const PASSAGE_LEXICON_REGISTRY: Record<string, LexicalEntry[]> = {
  // Salmos 23:1
  'Salmos 23:1': [
    {
      originalWord: 'יְהוָה',
      transliteration: 'Yahweh (YHWH)',
      strongCode: 'H3068',
      language: 'Hebreo',
      literalMeaning: 'El Autoexistente, el Eterno, «Yo Soy»',
      theologicalDefinition:
        'Nombre pactual sagrado de Dios en el Antiguo Testamento. No es una deidad impersonal o fuerza cósmica abstracta, sino el Dios vivo que se ata por juramento y gracia a cuidar de su pueblo.',
      misconceptionsToAvoid:
        'Evitar reducir a Dios a una energía cósmica o genio de deseos; Yahweh es el Soberano del pacto que exige lealtad y santidad.',
    },
    {
      originalWord: 'רֹעִי',
      transliteration: 'Ro’í (de la raíz רָעָה rā‘āh)',
      strongCode: 'H7462',
      language: 'Hebreo',
      literalMeaning: 'Mi pastor, quien me apacienta y vigila',
      theologicalDefinition:
        'En el Antiguo Cercano Oriente, el pastor vivía día y noche con el rebaño, arriesgando su vida contra leones y lobos. El sufijo posesivo («mi») denota relación íntima, comunión diaria y dependencia absoluta, no una relación lejana o burocrática.',
      misconceptionsToAvoid:
        'No considerar la figura del pastor como pasiva; el pastor oriental usaba vara (para disciplina y defensa) y cayado (para rescate). Guiaba por senderos ásperos, no siempre llanos.',
    },
    {
      originalWord: 'לֹא אֶחְסָר',
      transliteration: 'Lo’ ’eḥsār (del verbo חָסֵר ḥāsēr)',
      strongCode: 'H2637',
      language: 'Hebreo',
      literalMeaning: 'No careceré, no tendré mengua',
      theologicalDefinition:
        'Suficiencia soberana provista por la fidelidad de Dios. Significa que el creyente no carecerá de nada indispensable para cumplir el propósito divino, hallando reposo y contentamiento en Su voluntad.',
      misconceptionsToAvoid:
        'CRÍTICO: No confundir con la «teología de la prosperidad». El texto no promete lujos extravagantes, ausencia de sufrimiento ni inmunidad al valle de sombra (Sal 23:4). Significa que en medio de la prueba nada faltará de lo que Dios juzga necesario para el alma.',
    },
  ],

  // Salmos 23 (Integral, Capítulo Completo)
  'Salmos 23': [
    {
      originalWord: 'יְהוָה רֹעִי',
      transliteration: 'Yahweh Ro’í (H3068 / H7462)',
      strongCode: 'H3068 / H7462',
      language: 'Hebreo',
      literalMeaning: 'El Autoexistente que me pastorea y vigila',
      theologicalDefinition:
        'Nombre pactual sagrado de Dios en relación personal e íntima. El término no describe una deidad remota ni un observador cósmico pasivo, sino el Dios todopoderoso comprometido por juramento pactual a cuidar, alimentar y defender a cada una de sus ovejas redimidas.',
      misconceptionsToAvoid:
        'Evitar reducir a Dios a una energía cósmica o genio complaciente; Yahweh es el Soberano del pacto que exige sumisión gozosa y santidad.',
    },
    {
      originalWord: 'לֹא אֶחְסָר',
      transliteration: 'Lo’ ’eḥsār (del verbo חָסֵר ḥāsēr)',
      strongCode: 'H2637',
      language: 'Hebreo',
      literalMeaning: 'No careceré, no tendré mengua de nada indispensable',
      theologicalDefinition:
        'Suficiencia soberana provista por la fidelidad de Dios. Significa que el creyente no carecerá de lo necesario para cumplir el propósito divino y preservar su alma hasta el final, hallando reposo y contentamiento en Su santa voluntad.',
      misconceptionsToAvoid:
        'CRÍTICO: No confundir con la «teología de la prosperidad». El salmo no promete lujos extravagantes ni inmunidad al sufrimiento, sino que en toda circunstancia el cuidado divino sostiene al alma.',
    },
    {
      originalWord: 'צַלְמָוֶת',
      transliteration: 'Tsalmáwet (sombra de muerte / tiniebla densa)',
      strongCode: 'H6757',
      language: 'Hebreo',
      literalMeaning: 'Valle de densa oscuridad, desfiladero de sombras mortales',
      theologicalDefinition:
        'Alude a las cañadas escarpadas y sombrías del desierto de Judea donde acechan fieras y despeñaderos. Representa las temporadas más desgarradoras de dolor, persecución, enfermedad o pérdida que el creyente atraviesa.',
      misconceptionsToAvoid:
        'El salmista no dice «si ando», sino «aunque ande». Dios no promete exención de valles difíciles, sino la certeza absoluta de su compañía victoriosa: «porque Tú estarás conmigo».',
    },
    {
      originalWord: 'שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ',
      transliteration: 'Shibteḵā ūmish‘anteḵā (Tu vara y tu cayado)',
      strongCode: 'H7626 / H4938',
      language: 'Hebreo',
      literalMeaning: 'Tu vara corta de combate y tu cayado curvo de apoyo',
      theologicalDefinition:
        'La vara (shebet) simboliza la autoridad divina y el poder para repeler a lobos y fieras; el cayado (mish\'enet) simboliza la gracia tierna para rescatar a la oveja extraviada y corregir su senda con ternura paternal.',
      misconceptionsToAvoid:
        'No entender la disciplina divina como rechazo punitivo; la vara y el cayado infunden aliento porque confirman que somos hijos amados y cuidados, nunca huérfanos.',
    },
    {
      originalWord: 'שֻׁלְחָן',
      transliteration: 'Shulḥān (Mesa de banquete pactual)',
      strongCode: 'H7979',
      language: 'Hebreo',
      literalMeaning: 'Mesa servida / Banquete de comunión y asilo real',
      theologicalDefinition:
        'En la cultura del Antiguo Cercano Oriente, sentar a un siervo a tu mesa en presencia de sus perseguidores representaba un pacto inviolable de asilo y honra suprema. Dios corona de dignidad pública al creyente frente a las potestades del mal.',
      misconceptionsToAvoid:
        'La mesa no es una plataforma de venganza carnal humana, sino la proclamación del triunfo de la gracia divina sobre toda oposición espiritual.',
    },
    {
      originalWord: 'חֶסֶד',
      transliteration: 'Chésed (Amor leal y misericordia pactual)',
      strongCode: 'H2617',
      language: 'Hebreo',
      literalMeaning: 'Amor pactual perseverante, fidelidad inagotable',
      theologicalDefinition:
        'David utiliza el verbo radáf (perseguir con celo e insistencia): el bien y la misericordia de Dios persiguen activamente al creyente todos los días, sellando su destino seguro y eterno en la casa de Jehová.',
      misconceptionsToAvoid:
        'No rebajar chésed a complacencia o tolerancia permisiva; es el amor santo y redentor que rescata, transforma y preserva para la gloria.',
    },
  ],
  'Salmos 23:1-6': [
    {
      originalWord: 'יְהוָה רֹעִי',
      transliteration: 'Yahweh Ro’í (H3068 / H7462)',
      strongCode: 'H3068 / H7462',
      language: 'Hebreo',
      literalMeaning: 'El Autoexistente que me pastorea y vigila',
      theologicalDefinition:
        'Nombre pactual sagrado de Dios en relación personal e íntima. El término no describe una deidad remota ni un observador cósmico pasivo, sino el Dios todopoderoso comprometido por juramento pactual a cuidar, alimentar y defender a cada una de sus ovejas redimidas.',
      misconceptionsToAvoid:
        'Evitar reducir a Dios a una energía cósmica o genio complaciente; Yahweh es el Soberano del pacto que exige sumisión gozosa y santidad.',
    },
    {
      originalWord: 'לֹא אֶחְסָר',
      transliteration: 'Lo’ ’eḥsār (del verbo חָסֵר ḥāsēr)',
      strongCode: 'H2637',
      language: 'Hebreo',
      literalMeaning: 'No careceré, no tendré mengua de nada indispensable',
      theologicalDefinition:
        'Suficiencia soberana provista por la fidelidad de Dios. Significa que el creyente no carecerá de lo necesario para cumplir el propósito divino y preservar su alma hasta el final, hallando reposo y contentamiento en Su santa voluntad.',
      misconceptionsToAvoid:
        'CRÍTICO: No confundir con la «teología de la prosperidad». El salmo no promete lujos extravagantes ni inmunidad al sufrimiento, sino que en toda circunstancia el cuidado divino sostiene al alma.',
    },
    {
      originalWord: 'צַלְמָוֶת',
      transliteration: 'Tsalmáwet (sombra de muerte / tiniebla densa)',
      strongCode: 'H6757',
      language: 'Hebreo',
      literalMeaning: 'Valle de densa oscuridad, desfiladero de sombras mortales',
      theologicalDefinition:
        'Alude a las cañadas escarpadas y sombrías del desierto de Judea donde acechan fieras y despeñaderos. Representa las temporadas más desgarradoras de dolor, persecución, enfermedad o pérdida que el creyente atraviesa.',
      misconceptionsToAvoid:
        'El salmista no dice «si ando», sino «aunque ande». Dios no promete exención de valles difíciles, sino la certeza absoluta de su compañía victoriosa: «porque Tú estarás conmigo».',
    },
    {
      originalWord: 'שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ',
      transliteration: 'Shibteḵā ūmish‘anteḵā (Tu vara y tu cayado)',
      strongCode: 'H7626 / H4938',
      language: 'Hebreo',
      literalMeaning: 'Tu vara corta de combate y tu cayado curvo de apoyo',
      theologicalDefinition:
        'La vara (shebet) simboliza la autoridad divina y el poder para repeler a lobos y fieras; el cayado (mish\'enet) simboliza la gracia tierna para rescatar a la oveja extraviada y corregir su senda con ternura paternal.',
      misconceptionsToAvoid:
        'No entender la disciplina divina como rechazo punitivo; la vara y el cayado infunden aliento porque confirman que somos hijos amados y cuidados, nunca huérfanos.',
    },
    {
      originalWord: 'שֻׁלְחָן',
      transliteration: 'Shulḥān (Mesa de banquete pactual)',
      strongCode: 'H7979',
      language: 'Hebreo',
      literalMeaning: 'Mesa servida / Banquete de comunión y asilo real',
      theologicalDefinition:
        'En la cultura del Antiguo Cercano Oriente, sentar a un siervo a tu mesa en presencia de sus perseguidores representaba un pacto inviolable de asilo y honra suprema. Dios corona de dignidad pública al creyente frente a las potestades del mal.',
      misconceptionsToAvoid:
        'La mesa no es una plataforma de venganza carnal humana, sino la proclamación del triunfo de la gracia divina sobre toda oposición espiritual.',
    },
    {
      originalWord: 'חֶסֶד',
      transliteration: 'Chésed (Amor leal y misericordia pactual)',
      strongCode: 'H2617',
      language: 'Hebreo',
      literalMeaning: 'Amor pactual perseverante, fidelidad inagotable',
      theologicalDefinition:
        'David utiliza el verbo radáf (perseguir con celo e insistencia): el bien y la misericordia de Dios persiguen activamente al creyente todos los días, sellando su destino seguro y eterno en la casa de Jehová.',
      misconceptionsToAvoid:
        'No rebajar chésed a complacencia o tolerancia permisiva; es el amor santo y redentor que rescata, transforma y preserva para la gloria.',
    },
  ],

  // Juan 3:16
  'Juan 3:16': [
    {
      originalWord: 'ἠγάπησεν',
      transliteration: 'ēgapēsen (de ἀγάπη agápē)',
      strongCode: 'G26',
      language: 'Griego',
      literalMeaning: 'Amó con amor supremo y abnegado',
      theologicalDefinition:
        'Amor divino deliberado, incondicional y de iniciativa soberana. No nace de las cualidades del ser amado, sino del carácter santo y misericordioso del dador, expresado en el mayor sacrificio.',
      misconceptionsToAvoid:
        'No confundir agape con emoción pasajera (eros) ni afecto fraternal mutuo condicional (phileo). Es una determinación sacrificial inmutable.',
    },
    {
      originalWord: 'τὸν κόσμον',
      transliteration: 'ton kósmon (de κόσμος kósmos)',
      strongCode: 'G2889',
      language: 'Griego',
      literalMeaning: 'El orden creado caído, la humanidad enemistada con Dios',
      theologicalDefinition:
        'En la teología joánica, «kosmos» representa al mundo en rebelión y tinieblas que aborrece la luz. Lo asombroso del versículo no es que Dios ame algo bello, sino que ame a pecadores indignos y rebeldes.',
      misconceptionsToAvoid:
        'Evitar pensar que Dios amó al mundo porque el hombre merecía ser salvado; el mérito es 100% de la gracia de Cristo.',
    },
    {
      originalWord: 'τὸν υἱὸν τὸν μονογενῆ',
      transliteration: 'ton hyiòn ton monogenê (de μονογενής monogenḗs)',
      strongCode: 'G3439',
      language: 'Griego',
      literalMeaning: 'Hijo único en su género, de naturaleza singular',
      theologicalDefinition:
        'No significa «creado primero», sino «único en su clase, de la misma esencia del Padre». Expresa la filiación eterna y la deidad plena de Jesucristo.',
      misconceptionsToAvoid:
        'Desmontar la herejía arriana o testiga de que Jesús fue un ángel o una criatura inicial. Monogenés expresa unicidad relacional eterna con el Padre.',
    },
    {
      originalWord: 'πᾶς ὁ πιστεύων',
      transliteration: 'pas ho pisteúōn (de πίστις pístis)',
      strongCode: 'G4102',
      language: 'Griego',
      literalMeaning: 'Todo aquel que continúa creyendo / confiando activamente',
      theologicalDefinition:
        'Participio presente activo que describe fe viva, perseverante y transformadora, no un simple asentimiento intelectual pasivo de una sola vez.',
      misconceptionsToAvoid:
        'La salvación no es una fórmula vacía repetida mecánicamente, sino rendición de vida y confianza personal perseverante en el Hijo.',
    },
  ],

  // Romanos 8:28
  'Romanos 8:28': [
    {
      originalWord: 'συνεργεῖ εἰς ἀγαθόν',
      transliteration: 'synergeî eis agathón',
      strongCode: 'G4903',
      language: 'Griego',
      literalMeaning: 'Dios hace cooperar o trabajar conjuntamente para el bien',
      theologicalDefinition:
        'Providencia orquestada por Dios donde incluso el sufrimiento, la persecución y el dolor son transformados para cumplir el bien supremo: conformarnos a la imagen de Cristo (v. 29).',
      misconceptionsToAvoid:
        'No promete que todas las cosas que ocurren sean buenas en sí mismas (el pecado y la tragedia siguen siendo malos), sino que la soberanía de Dios subyuga el mal para Su propósito redentor.',
    },
    {
      originalWord: 'τοῖς κατὰ πρόθεσιν κλητοῖς',
      transliteration: 'toîs katà próthesin klētoîs',
      strongCode: 'G4286 / G2822',
      language: 'Griego',
      literalMeaning: 'A los llamados conforme a su propósito soberano',
      theologicalDefinition:
        'La promesa tiene destinatarios específicos: los regenerados que aman a Dios. La base de la seguridad no radica en la fuerza humana, sino en el decreto pactual divino.',
      misconceptionsToAvoid:
        'No aplicar este versículo indiscriminadamente a quienes desprecian a Dios; es una promesa de consuelo reservada para el pueblo de fe.',
    },
  ],

  // Génesis 1:1
  'Génesis 1:1': [
    {
      originalWord: 'בְּרֵאשִׁית',
      transliteration: 'Bərē’šît (de רֹאשׁ rō’š)',
      strongCode: 'H7225',
      language: 'Hebreo',
      literalMeaning: 'En el principio / en el origen supremo',
      theologicalDefinition:
        'Inauguración del tiempo, del espacio y de la materia por determinación divina. El universo no es eterno ni fruto del azar cíclico.',
      misconceptionsToAvoid:
        'Refuta el panteísmo y el materialismo ateo; Dios existe antes de la creación y no se confunde con ella.',
    },
    {
      originalWord: 'בָּרָא',
      transliteration: 'Bārā’',
      strongCode: 'H1254',
      language: 'Hebreo',
      literalMeaning: 'Creó de la nada (ex nihilo)',
      theologicalDefinition:
        'Verbo reservado en la Biblia hebrea exclusivamente para Dios como sujeto. Nunca se aplica a la artesanía humana. Describe creación sin materia preexistente.',
      misconceptionsToAvoid:
        'Diferenciar de «asáh» (H6213, hacer con materiales preexistentes). «Bará» denota omnipotencia y soberanía cósmica absoluta.',
    },
    {
      originalWord: 'אֱלֹהִים',
      transliteration: '’Ĕlōhîm',
      strongCode: 'H430',
      language: 'Hebreo',
      literalMeaning: 'Dios (plural de majestad y plenitud)',
      theologicalDefinition:
        'Forma plural de El/Eloah que connota soberanía suprema, grandeza y anticipación canónica de la Trinidad, concordando gramaticalmente con verbos en singular (bārā’).',
      misconceptionsToAvoid:
        'No denota politeísmo ni muchos dioses; la sintaxis monoteísta utiliza verbo singular para afirmar al único Dios todopoderoso.',
    },
  ],

  // Filipenses 4:13
  'Filipenses 4:13': [
    {
      originalWord: 'πάντα ἰσχύω',
      transliteration: 'pánta ischýō',
      strongCode: 'G3956 / G2480',
      language: 'Griego',
      literalMeaning: 'Tengo fuerzas para todas estas cosas / puedo hacer frente a todo',
      theologicalDefinition:
        'En su contexto inmediato (vv. 11-12), «todas las cosas» refiere a vivir en escasez o en abundancia, tener hambre o estar saciado, manteniendo contentamiento espiritual en Cristo.',
      misconceptionsToAvoid:
        'CRÍTICO: Desmontar el uso supersticioso como amuleto o varita mágica para ganar competencias deportivas, ganar dinero o lograr cualquier capricho egoísta. Pablo habla de fortaleza sobrenatural para soportar adversidad por la causa del Evangelio.',
    },
    {
      originalWord: 'ἐν τῷ ἐνδυναμοῦντί με',
      transliteration: 'en tô endynamoûntí me',
      strongCode: 'G1743',
      language: 'Griego',
      literalMeaning: 'En aquel que continuamente me infunde poder interior',
      theologicalDefinition:
        'Participio presente activo: el poder no es inherente al ser humano, sino un flujo continuo de la gracia de Cristo que capacita la voluntad.',
      misconceptionsToAvoid:
        'Evitar el orgullo moral o autosuficiencia; sin la unión vital con Cristo no podemos hacer nada (Jn 15:5).',
    },
  ],
};

/**
 * Extrae referencias bíblicas estructuradas (Libro, Capítulo, Versículo) de un prompt de usuario.
 */
export function extractBiblicalReference(text: string): ExtractedPassage | null {
  if (!text || text.trim().length === 0) return null;

  const normalized = text.trim();

  // Patrón 1: Libro Cap:Vers[-Fin] (ej: "Salmos 23:1", "Salmo 23:1-4", "Juan 3:16", "1 Corintios 13:4-8")
  const p1 = /\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d{1,3})\s*[:.,]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/i;
  const m1 = normalized.match(p1);
  if (m1) {
    const bookCandidate = m1[1].trim();
    const chapter = parseInt(m1[2], 10);
    const vStart = parseInt(m1[3], 10);
    const vEnd = m1[4] ? parseInt(m1[4], 10) : undefined;

    const book = findCanonicalBook(bookCandidate);
    if (book && chapter >= 1 && chapter <= book.capitulos) {
      const citation = `${book.nombre} ${chapter}:${vStart}${vEnd ? `-${vEnd}` : ''}`;
      return {
        canonicalBook: book,
        bookName: book.nombre,
        chapter,
        verseStart: vStart,
        verseEnd: vEnd,
        formattedCitation: citation,
        isVerseSpecific: true,
        isChapterSpecific: true,
      };
    }
  }

  // Patrón 2: Libro Cap versículo Vers (ej: "Salmo 23 versiculo 1", "Mateo 5 v 3", "Romanos 8 versículo 28")
  const p2 = /\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d{1,3})\s*(?:vers[íi]culo|versiculo|v\.?)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/i;
  const m2 = normalized.match(p2);
  if (m2) {
    const bookCandidate = m2[1].trim();
    const chapter = parseInt(m2[2], 10);
    const vStart = parseInt(m2[3], 10);
    const vEnd = m2[4] ? parseInt(m2[4], 10) : undefined;

    const book = findCanonicalBook(bookCandidate);
    if (book && chapter >= 1 && chapter <= book.capitulos) {
      const citation = `${book.nombre} ${chapter}:${vStart}${vEnd ? `-${vEnd}` : ''}`;
      return {
        canonicalBook: book,
        bookName: book.nombre,
        chapter,
        verseStart: vStart,
        verseEnd: vEnd,
        formattedCitation: citation,
        isVerseSpecific: true,
        isChapterSpecific: true,
      };
    }
  }

  // Patrón 3: Capítulo X Versículo Y de [Libro] (ej: "capitulo 23 versiculo 1 de Salmos")
  const p3 = /(?:cap[íi]tulo|capitulo|cap\.?)\s*(\d{1,3})\s*(?:vers[íi]culo|versiculo|v\.?)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:de|del|en)\s*([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]+)/i;
  const m3 = normalized.match(p3);
  if (m3) {
    const chapter = parseInt(m3[1], 10);
    const vStart = parseInt(m3[2], 10);
    const vEnd = m3[3] ? parseInt(m3[3], 10) : undefined;
    const bookCandidate = m3[4].trim();

    const book = findCanonicalBook(bookCandidate);
    if (book && chapter >= 1 && chapter <= book.capitulos) {
      const citation = `${book.nombre} ${chapter}:${vStart}${vEnd ? `-${vEnd}` : ''}`;
      return {
        canonicalBook: book,
        bookName: book.nombre,
        chapter,
        verseStart: vStart,
        verseEnd: vEnd,
        formattedCitation: citation,
        isVerseSpecific: true,
        isChapterSpecific: true,
      };
    }
  }

  // Patrón 4: Libro Cap (ej: "Salmo 23", "Romanos 8", "Génesis 1", "Mateo 5")
  const p4 = /\b([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d{1,3})\b/i;
  const m4 = normalized.match(p4);
  if (m4) {
    const bookCandidate = m4[1].trim();
    const chapter = parseInt(m4[2], 10);

    const book = findCanonicalBook(bookCandidate);
    if (book && chapter >= 1 && chapter <= book.capitulos) {
      let vEnd: number | undefined = undefined;
      if (book.nombre === 'Salmos' && chapter === 23) vEnd = 6;
      else if (book.nombre === 'Salmos' && chapter === 1) vEnd = 6;
      else if (book.nombre === 'Salmos' && chapter === 100) vEnd = 5;
      else if (book.nombre === 'Salmos' && chapter === 121) vEnd = 8;
      else if (book.nombre === 'Salmos' && chapter === 150) vEnd = 6;

      const citation = vEnd ? `${book.nombre} ${chapter}:1-${vEnd}` : `${book.nombre} ${chapter}`;
      return {
        canonicalBook: book,
        bookName: book.nombre,
        chapter,
        verseStart: 1,
        verseEnd: vEnd,
        formattedCitation: citation,
        isVerseSpecific: false,
        isChapterSpecific: true,
      };
    }
  }

  return null;
}

/**
 * Obtiene el glosario léxico y etimológico para un pasaje o libro específico.
 */
export function getLexiconForPassage(
  book: CanonicalBookProfile,
  chapter: number,
  verseStart?: number,
  verseEnd?: number
): LexicalEntry[] {
  if (verseStart && verseEnd) {
    const rangeKey = `${book.nombre} ${chapter}:${verseStart}-${verseEnd}`;
    if (PASSAGE_LEXICON_REGISTRY[rangeKey]) {
      return PASSAGE_LEXICON_REGISTRY[rangeKey];
    }
  }

  const chapterKey = `${book.nombre} ${chapter}`;
  if (!verseStart || (verseStart === 1 && verseEnd)) {
    if (PASSAGE_LEXICON_REGISTRY[chapterKey]) {
      return PASSAGE_LEXICON_REGISTRY[chapterKey];
    }
  }

  if (verseStart) {
    const specificVerseKey = `${book.nombre} ${chapter}:${verseStart}`;
    if (PASSAGE_LEXICON_REGISTRY[specificVerseKey]) {
      return PASSAGE_LEXICON_REGISTRY[specificVerseKey];
    }
  }

  if (PASSAGE_LEXICON_REGISTRY[chapterKey]) {
    return PASSAGE_LEXICON_REGISTRY[chapterKey];
  }

  // Generador contextual canónico según el Testamento y temática del libro
  if (book.testamento === 'AT') {
    return [
      {
        originalWord: 'יְהוָה / חֶסֶד',
        transliteration: 'Yahweh / Chésed',
        strongCode: 'H3068 / H2617',
        language: 'Hebreo',
        literalMeaning: 'El Dios pactual / Su misericordia y amor leal inmutable',
        theologicalDefinition:
          `En el contexto veterotestamentario de ${book.nombre}, la revelación resalta la fidelidad del pacto divino frente a la fragilidad humana. El término central evoca el compromiso inquebrantable de Dios de guardar a sus escogidos.`,
        misconceptionsToAvoid:
          'Evitar interpretar la ley o los cánticos del AT como simple legalismo o moralismo; toda la revelación señala a la gracia redentora y a la provisión soberana de Dios.',
      },
      {
        originalWord: 'שָׁלוֹם',
        transliteration: 'Shālôm (de שָׁלַם shālam)',
        strongCode: 'H7965',
        language: 'Hebreo',
        literalMeaning: 'Paz, plenitud, bienestar integral, estar completo',
        theologicalDefinition:
          'Shalom no es mera ausencia de guerra o conflicto externo, sino una condición de armonía pactual con Dios que produce quietud interior y santidad.',
        misconceptionsToAvoid:
          'No reducir shalom a tranquilidad psicológica temporal ni a prosperidad económica materialista.',
      },
    ];
  } else {
    return [
      {
        originalWord: 'χάρις / πίστις',
        transliteration: 'Cháris / Pístis',
        strongCode: 'G5485 / G4102',
        language: 'Griego',
        literalMeaning: 'Gracia inmerecida / Fe y lealtad transformadora',
        theologicalDefinition:
          `En la teología neotestamentaria de ${book.nombre}, Dios revela que la reconciliación y la vida cristiana operan por gracia mediante la fe en la persona y obra de Cristo Jesús.`,
        misconceptionsToAvoid:
          'No concebir la gracia como licencia para pecar (antinomianismo), ni la fe como simple pensamiento positivo o fórmula de atracción mental.',
      },
      {
        originalWord: 'δικαιοσύνη / ζωή',
        transliteration: 'Dikaiosýnē / Zōḗ',
        strongCode: 'G1343 / G2222',
        language: 'Griego',
        literalMeaning: 'Justicia judicial imputada / Vida eterna en plenitud',
        theologicalDefinition:
          'El estado de justificación concedido legalmente por Dios al creyente, infundiendo vida incorruptible que vence el poder del pecado.',
        misconceptionsToAvoid:
          'Desmontar la idea de que la justificación se gana por obras o méritos propios; es un regalo imputado por la fe en el Cordero de Dios.',
      },
    ];
  }
}

/**
 * Sintetizador Exegético de Alta Fidelidad para Versículos Específicos:
 * Responde con precisión al versículo puntual que el usuario solicitó,
 * definiendo términos en sus idiomas originales, desmontando alucinaciones doctrinales
 * y cerrando con una pregunta pastoral reflexiva (Regla de Ping-Pong).
 */
export function composeSpecificPassageExegesis(
  ref: ExtractedPassage,
  _level: UserTheologicalLevel,
  _prompt: string,
  availableCitations: string[]
): string {
  const { canonicalBook, bookName, chapter, verseStart, verseEnd, formattedCitation } = ref;

  const isFullPsalm23 =
    bookName === 'Salmos' &&
    chapter === 23 &&
    (!ref.isVerseSpecific || (verseStart === 1 && verseEnd === 6) || formattedCitation.includes('Salmos 23:1-6') || formattedCitation === 'Salmos 23');

  // =========================================================================
  // CASO ESPECIAL: ESTUDIO INTEGRAL DEL SALMO 23 COMPLETO (vv. 1-6)
  // =========================================================================
  if (isFullPsalm23) {
    const fullCitationTag = `[CITA: Salmos 23:1-6]`;
    const fullLexicon = getLexiconForPassage(canonicalBook, 23, undefined, undefined);

    let lexiconText =
      `2. **Léxico Original y Definiciones Exegéticas (Raíces Hebreas del Salmo 23)**\n` +
      `   *(Para comprender el texto sagrado con fidelidad y evitar que interpretaciones erróneas o doctrinas inventadas desvíen el sentido bíblico, examinamos los términos clave en su idioma original):*\n\n`;

    fullLexicon.forEach((item) => {
      lexiconText +=
        `   • **${item.originalWord} (${item.transliteration}${item.strongCode ? ` - Código Strong: ${item.strongCode}` : ''}) [${item.language}]:**\n` +
        `     - *Significado literal:* ${item.literalMeaning}.\n` +
        `     - *Definición teológica:* ${item.theologicalDefinition}\n` +
        `     - *Aclaración indispensable:* ${item.misconceptionsToAvoid}\n\n`;
    });

    return (
      `### Estudio Exegético y Teológico Integral: Salmo 23 (Completo, vv. 1-6)\n\n` +
      `${fullCitationTag}\n\n` +
      `1. **Marco Histórico y Estructura Literaria del Salmo**\n` +
      `   - **Autor y Fecha:** David (Salmo de David — Mizmor leDavid) (Compuesto por David, evocando con profunda gratitud su juventud como pastor en Belén y la fidelidad providencial de Dios a lo largo de todas sus pruebas y batallas).\n` +
      `   - **Propósito Revelado:** Conducir al alma creyente a encontrar reposo supremo en la providencia, protección y comunión soberana del Dios del pacto, superando todo temor ante la aflicción terrenal.\n` +
      `   - **Estructura Canónica (Los Tres Movimientos Progresivos):**\n` +
      `     • *Movimiento I (vv. 1-3):* El Pastor que sacia, aquieta y restaura el alma guiándola por sendas de justicia por amor de Su nombre.\n` +
      `     • *Movimiento II (v. 4):* El Compañero fiel en el valle de sombra de muerte (transición gramatical de «Él» a la 2ª persona íntima: «Tú estarás conmigo»).\n` +
      `     • *Movimiento III (vv. 5-6):* El Anfitrión del pacto, la mesa servida en victoria ante angustiadores, la copa desbordante y la morada eterna en la casa de Jehová.\n\n` +
      lexiconText +
      `3. **Desglose Expositivo Versículo por Versículo de los Tres Movimientos**\n` +
      `   - **Movimiento I (vv. 1-3) - El Pastor y la provisión abundante:**\n` +
      `     • *v. 1 («Jehová es mi pastor; nada me faltará»):* Confesión de gozosa dependencia. David, ungido rey, reconoce que ante Dios él es solo una oveja necesitada de pastoreo continuo y sustento soberano.\n` +
      `     • *v. 2 («En lugares de delicados pastos me hará yacer; junto a aguas de reposo me pastoreará»):* Las ovejas rehúyen corrientes turbulentas; Dios las conduce a manantiales de reposo para saciar su sed y renovar sus fuerzas en quietud.\n` +
      `     • *v. 3 («Confortará mi alma; guiárame por sendas de justicia por amor de su nombre»):* «Nefesh» denota restauración total de la vida interior. La brújula del camino divino es la justicia, y el motivo supremo es la vindicación de Su santo Nombre.\n\n` +
      `   - **Movimiento II (v. 4) - El Compañero en la aflicción extrema:**\n` +
      `     • *v. 4 («Aunque ande en valle de sombra de muerte, no temeré mal alguno...»):* Salto gramatical sublime: David ya no habla *acerca* de Dios («Él»), sino que habla *con* Dios cara a cara: **«porque Tú estarás conmigo»**. En la noche más sombría del dolor o el peligro, la verdad abstracta se torna presencia viva. La vara de defensa y el cayado de rescate infunden consuelo inquebrantable.\n\n` +
      `   - **Movimiento III (vv. 5-6) - El Banquete del Rey y la morada eterna:**\n` +
      `     • *v. 5 («Aderezarás mesa delante de mí en presencia de mis angustiadores; ungiste mi cabeza con aceite; mi copa está rebosando»):* Victoria pactual manifiesta. Dios sienta a su siervo como comensal de honor ante la mirada impotente del adversario; el aceite de gozo y la copa desbordante sellan su abundancia de gracia.\n` +
      `     • *v. 6 («Ciertamente el bien y la misericordia me seguirán todos los días de mi vida; y en la casa de Jehová moraré por largos días»):* Coronación de la esperanza. La vida de fe no concluye en derrota ni en el sepulcro, sino en la morada eterna en comunión con el Padre celestial.\n\n` +
      `4. **Clarificaciones Exegéticas y Prevención de Doctrinas Inventadas**\n` +
      `   - *Desmontar la «teología de la prosperidad»:* «Nada me faltará» no es un decreto de riqueza material, sino la seguridad de que Dios suplirá todo lo espiritualmente necesario para perseverar.\n` +
      `   - *Desmontar el uso supersticioso:* El Salmo 23 no es un talismán de protección mágica, sino una revelación de pacto que demanda rendición del corazón y fe perseverante.\n` +
      `   - *Desmontar la falacia de inmunidad:* El creyente no está exento de caminar por valles oscuros, pero tiene la promesa inmutable de no caminar solo.\n\n` +
      `5. **Conexión Cristológica y Coherencia Canónica**\n` +
      `   - Este salmo halla su cumplimiento definitivo en la persona y obra de Jesucristo:\n` +
      `   - [CITA: Juan 10:11]\n` +
      `   - [CITA: Juan 10:27]\n` +
      `   - [CITA: Juan 10:28]\n` +
      `   - [CITA: 1 Pedro 2:25]\n` +
      `   - Jesús es el Buen Pastor supremo que puso su propia vida en la cruz para librar a sus ovejas de la muerte eterna y asegurarles un lugar inmutable en la mesa del Padre.\n\n` +
      `6. **Aplicación Pastoral y Pregunta para tu Meditación:**\n` +
      `* Al contemplar hoy que Jehová es tu Pastor que sacia tu alma, camina contigo en el valle y prepara mesa para ti, ¿en qué situación específica de temor, afán o incertidumbre estás llamado a dejar de luchar en tus propias fuerzas para descansar plenamente en el cuidado y la fidelidad del Buen Pastor?\n\n` +
      `💡 *Puedes presionar **"Fijar"** debajo de este estudio para guardarlo en tu Pizarra y continuar profundizando en él.*`
    );
  }

  // =========================================================================
  // CASO GENERAL: ESTUDIO DE VERSÍCULO ESPECÍFICO O PASAJE PUNTUAL
  // =========================================================================
  const citationTag = `[CITA: ${formattedCitation}]`;
  const lexicon = getLexiconForPassage(canonicalBook, chapter, verseStart, verseEnd);

  // Determinar cita cristológica o intertextual de apoyo
  let crossRefCitation = availableCitations.find((c) => !c.includes(bookName) && !c.includes(formattedCitation));
  if (!crossRefCitation) {
    if (bookName === 'Salmos' && chapter === 23) crossRefCitation = 'Juan 10:11';
    else if (bookName === 'Juan' && chapter === 3) crossRefCitation = 'Romanos 5:8';
    else if (bookName === 'Romanos' && chapter === 8) crossRefCitation = 'Génesis 50:20';
    else if (bookName === 'Génesis' && chapter === 1) crossRefCitation = 'Juan 1:1-3';
    else if (bookName === 'Filipenses' && chapter === 4) crossRefCitation = '2 Corintios 12:9';
    else crossRefCitation = canonicalBook.testamento === 'AT' ? 'Juan 1:14' : 'Salmos 119:105';
  }

  // Determinar autor y contexto específico para el libro y capítulo puntual
  let specificAuthor = canonicalBook.autor;
  let specificContext = canonicalBook.contextoHistorico;

  if (bookName === 'Salmos') {
    if (chapter === 23) {
      specificAuthor = 'David (Salmo de David — Mizmor leDavid)';
      specificContext = 'Compuesto por David, evocando con profunda gratitud su juventud como pastor en Belén y la fidelidad providencial de Dios';
    } else if (chapter === 90) {
      specificAuthor = 'Moisés (Oración de Moisés, varón de Dios)';
      specificContext = 'Compuesto durante la travesía de 40 años en el desierto';
    } else if (chapter === 51) {
      specificAuthor = 'David (Salmo penitencial tras la visita del profeta Natán)';
      specificContext = 'Confesión de pecado y súplica de perdón, pureza y restauración interior';
    } else if (chapter >= 73 && chapter <= 83) {
      specificAuthor = 'Asaf (Director del canto levítico en el Tabernáculo)';
      specificContext = 'Reflexión y lamento pactual ante la aparente prosperidad de los impíos y el juicio de Dios';
    } else {
      specificAuthor = 'David y los salmistas inspirados de Israel';
    }
  } else if (bookName === 'Proverbios') {
    if (chapter === 30) {
      specificAuthor = 'Agur hijo de Jaqué';
    } else if (chapter === 31) {
      specificAuthor = 'Rey Lemuel (exhortación y profecía que le enseñó su madre)';
    } else {
      specificAuthor = 'Salomón (Rey de Israel)';
    }
  }

  // 1. TÍTULO Y CITA LITERAL
  const header = `### Estudio Exegético y Teológico Detallado: ${formattedCitation}\n\n`;
  const scriptureBlock = `${citationTag}\n\n`;

  // 2. CONTEXTO HISTÓRICO Y LITERARIO INMEDIATO
  const contextSection =
    `1. **Marco Histórico y Contexto Canónico Inmediato**\n` +
    `   - **Autor y Fecha:** ${specificAuthor} (${specificContext}).\n` +
    `   - **Propósito Revelado:** ${canonicalBook.propositoTeologico}\n` +
    `   - **Ubicación en la Perícopa:** Este texto no está aislado; pertenece a la revelación en ${bookName} ${chapter}, donde el Señor confronta el corazón y expone el pacto de su gracia frente a la condición humana.\n\n`;

  // 3. DEFINICIONES Y LÉXICO ORIGINAL (HEBREO / GRIEGO) - ANTIMALINTERPRETACIÓN
  let lexiconSection =
    `2. **Léxico Original y Definiciones Exegéticas (Raíces de las Palabras)**\n` +
    `   *(Para comprender el texto sagrado con fidelidad y evitar que interpretaciones erróneas o doctrinas inventadas desvíen el sentido bíblico, examinamos los términos clave en su idioma original):*\n\n`;

  lexicon.forEach((item) => {
    lexiconSection +=
      `   • **${item.originalWord} (${item.transliteration}${item.strongCode ? ` - Código Strong: ${item.strongCode}` : ''}) [${item.language}]:**\n` +
      `     - *Significado literal:* ${item.literalMeaning}.\n` +
      `     - *Definición teológica:* ${item.theologicalDefinition}\n` +
      `     - *Aclaración indispensable:* ${item.misconceptionsToAvoid}\n\n`;
  });

  // 4. DESGLOSE CLÁUSULA POR CLÁUSULA Y SIGNIFICADO DIRECTO
  const clauseSection =
    `3. **Desglose Expositivo y Significado Doctrinal Profundo**\n` +
    (bookName === 'Salmos' && chapter === 23 && verseStart === 1
      ? `   - **«Jehová es mi pastor»:** Afirmación de sujeción gozosa. David, habiendo sido pastor de ovejas en Belén, reconoce que ante Dios él no es el rey soberano, sino una oveja necesitada de guía, protección y cuidado constante. La gloria del pacto radica en que Yahweh no nos abandona a nuestras propias fuerzas.\n` +
        `   - **«Nada me faltará»:** Confesión de contentamiento y plenitud en la provisión divina. No garantiza la ausencia de valles oscuros o batallas, sino la certeza absoluta de que el Pastor proveerá todo lo necesario para sostener nuestra fe y preservar nuestra alma para su Reino celestial.\n\n`
      : `   - **La iniciativa soberana del texto:** La revelación expone que la fidelidad de Dios precede cualquier respuesta humana. La verdad afirmada en ${formattedCitation} fundamenta la seguridad del creyente en el carácter inmutable de Dios y no en circunstancias terrenales fluctuantes.\n` +
        `   - **El llamado a la rendición y confianza:** El versículo demanda una fe viva que abandone la autosuficiencia para descansar en la providencia y dirección del Creador.\n\n`);

  // 5. CUMPLIMIENTO CRISTOLÓGICO E INTERTEXTUAL
  const christologySection =
    `4. **Conexión Cristológica y Coherencia Canónica**\n` +
    (bookName === 'Salmos' && chapter === 23
      ? `   - Este Salmo halla su cumplimiento perfecto y eterno en la persona de Jesucristo, quien declaró solemnemente:\n` +
        `   - [CITA: ${crossRefCitation}]\n` +
        `   - Mientras el pastor terrenal puede fallar, Jesús es el Buen Pastor que no huye ante el lobo, sino que entregó su propia vida en la cruz para redimir a sus ovejas y darles vida eterna.\n\n`
      : `   - Todo el testimonio bíblico converge en la persona y obra de Jesucristo. El principio revelado en este pasaje resuena y se confirma a través de las Escrituras:\n` +
        `   - [CITA: ${crossRefCitation}]\n` +
        `   - En Cristo se cumplen todas las promesas y se sella la fidelidad de la Palabra de Dios.\n\n`);

  // 6. APLICACIÓN PASTORAL Y REGLA DEL PING-PONG
  const applicationSection =
    `5. **Aplicación Pastoral y Pregunta para tu Meditación:**\n` +
    (bookName === 'Salmos' && chapter === 23
      ? `* Al meditar hoy en que el Señor es tu Pastor personal, ¿en qué área concreta de tu vida (finanzas, salud, familia o decisiones futuras) estás sintiendo la tentación de vivir con afán o controlar todo tú mismo, en lugar de descansar en su pastoreo soberano?`
      : `* ¿De qué manera la verdad revelada en ${formattedCitation} confronta hoy tus prioridades y te invita a dar un paso de fe y descanso en el Señor?`);

  const agreementsBlock =
    `\n\n---\n` +
    `**Herramientas Homiléticas Disponibles (Toca para desarrollar el formato completo):**\n` +
    `[ACUERDO: Desarrollar Sermón Expositivo de Culto sobre ${formattedCitation}]\n` +
    `[ACUERDO: Desarrollar Lección de Escuela Dominical sobre ${formattedCitation}]\n` +
    `[ACUERDO: Desarrollar Guía para Célula / Jóvenes sobre ${formattedCitation}]`;

  const footer = `\n\n💡 *Puedes presionar **"Fijar"** debajo de este estudio para guardarlo en tu Pizarra y continuar profundizando en él.*`;

  return header + scriptureBlock + contextSection + lexiconSection + clauseSection + christologySection + applicationSection + agreementsBlock + footer;
}

/**
 * Sintetizador de Guía Pedagógica y Acompañamiento para el Estudio de un Libro Completo:
 * Enseña al usuario cómo estudiar el libro, define con claridad los términos clave que
 * encontrará a lo largo de los capítulos para prevenir interpretaciones distorsionadas,
 * y propone un plan modular por etapas.
 */
export function composeBookStudyGuide(
  book: CanonicalBookProfile,
  _level: UserTheologicalLevel,
  _prompt: string,
  availableCitations: string[]
): string {
  const c1 = availableCitations[0] || `${book.nombre} ${book.versiculosClaveRefs[0] || '1:1'}`;
  const c2 = availableCitations[1] || `${book.nombre} ${book.versiculosClaveRefs[1] || '1:2'}`;

  // Glosario doctrinal específico para los términos dominantes del libro
  let termsList = '';
  if (book.nombre === 'Romanos') {
    termsList =
      `   • **Justificación (Dikaiosyne - G1343):** Declaración judicial por la cual Dios declara justo al pecador únicamente por la fe en los méritos de Cristo, no por obras de la ley.\n` +
      `   • **Gracia (Charis - G5485):** Favor soberano e inmerecido de Dios hacia quienes merecían juicio.\n` +
      `   • **Santificación (Hagiasmos - G38):** Proceso continuo por el cual el Espíritu Santo conforma al creyente a la imagen de Jesús.\n` +
      `   • **Propiciación (Hilasterion - G2435):** Sacrificio que satisface la santa justicia y la ira justa de Dios contra el pecado.`;
  } else if (book.nombre === 'Salmos') {
    termsList =
      `   • **Misericordia pactual (Jesed - H2617):** Amor leal, fiel e inquebrantable de Dios que sostiene a su pueblo en el dolor y en el gozo.\n` +
      `   • **Alabanza reverente (Tehillah - H8416):** Cántico de celebración y adoración que brota de contemplar las obras y atributos de Dios.\n` +
      `   • **Paz integral (Shalom - H7965):** Plenitud y reposo del alma bajo el cuidado soberano del Altísimo.\n` +
      `   • **Refugio (Jasah - H2620):** Amparo activo y seguro en Dios frente a los peligros y adversidades.`;
  } else if (book.nombre === 'Génesis') {
    termsList =
      `   • **Creación de la nada (Bará - H1254):** Acto omnipotente y soberano de Dios al traer a existencia todo lo visible e invisible.\n` +
      `   • **Pacto (Berit - H1285):** Vínculo sagrado y soberano establecido por Dios con su creación y con los patriarcas.\n` +
      `   • **Providencia:** La mano invisible de Dios que gobierna los acontecimientos humanos para bien de los que le aman (Gn 50:20).\n` +
      `   • **Bendición (Barak - H1288):** Impartición divina de vida, multiplicación y propósito en comunión con el Creador.`;
  } else {
    termsList =
      `   • **Pacto y Gracia:** La iniciativa soberana de Dios que llama y preserva a su pueblo.\n` +
      `   • **Fidelidad y Fe:** La respuesta obediente y de confianza activa ante las promesas del Señor.\n` +
      `   • **Santidad:** Separación del mal y consagración total al servicio y adoración de Dios.`;
  }

  // Módulos pedagógicos del libro
  const modulesList = book.seccionesPrincipales
    .map((sec, idx) => `   - **Etapa ${idx + 1}:** ${sec}`)
    .join('\n');

  return (
    `### Guía Pedagógica y Acompañamiento: Libro de ${book.nombre}\n\n` +
    `**Autor y Marco:** ${book.autor} | ${book.contextoHistorico}\n` +
    `**Eje Doctrinal:** ${book.temaCentral}\n` +
    `**Propósito Teológico:** ${book.propositoTeologico}\n\n` +
    `1. **Léxico y Definiciones Doctrinales Fundamentales del Libro**\n` +
    `   *(Para interpretar con solidez ${book.nombre} y no inventar doctrinas ajenas al texto, es indispensable fijar las definiciones de los conceptos teológicos que estructuran este libro):*\n` +
    `${termsList}\n\n` +
    `2. **Hoja de Ruta de Aprendizaje (Etapas de Estudio Guiado)**\n` +
    `${modulesList}\n\n` +
    `3. **Pasajes Clave para Memorizar y Meditar:**\n` +
    `   - [CITA: ${c1}]\n` +
    `   - [CITA: ${c2}]\n\n` +
    `4. **Acompañamiento Paso a Paso (Regla del Ping-Pong):**\n` +
    `* Hemos preparado esta hoja de ruta para acompañarte capítulo por capítulo. ¿Te gustaría que comencemos explorando juntos la **Etapa 1**, o prefieres que analicemos en detalle la definición y aplicación de alguno de los términos teológicos clave?\n\n` +
    `---\n` +
    `**Herramientas Homiléticas y Pedagógicas (Toca para desarrollar el formato completo):**\n` +
    `[ACUERDO: Desarrollar Serie de 4 Semanas sobre ${book.nombre}]\n` +
    `[ACUERDO: Desarrollar Lección de Escuela Dominical sobre ${book.nombre}]\n` +
    `[ACUERDO: Desarrollar Sermón Expositivo de Culto sobre ${book.nombre}]`
  );
}
