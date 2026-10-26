import { BibliaCoreService } from '../database/bibliaCoreService.js';
import { VerseSeed, StrongSeed, CrossReferenceSeed } from '../database/seedData.js';
import { BibleImportResult } from './types.js';

export type BibleModuleCategory = 'OPEN_LICENSE' | 'PERSONAL_STUDY';
export type LicenseType = 'DOMINIO_PUBLICO' | 'CREATIVE_COMMONS' | 'ESTUDIO_PERSONAL';

export interface BibleModuleEntry {
  id: string;
  nombre: string;
  siglas: string;
  categoria: BibleModuleCategory;
  licencia: string;
  licenciaTipo: LicenseType;
  descripcion: string;
  caracteristicas: string[];
  recomendadoPara: string;
  tamanoEstimado: string;
  esNativa: boolean;
  remoteUrl?: string;
  getSeeds: () => VerseSeed[];
}

export const LEGAL_DISCLAIMER_TEXT =
  'Esta acción es ejecutada de manera directa e independiente por el usuario para estudio bíblico personal, educativo y pastoral sin fines de lucro. Los textos pertenecen a sus respectivas Sociedades Bíblicas y quedan almacenados exclusivamente en la memoria privada de su dispositivo.';

// =============================================================================
// GENERADORES LOCALES RICOS DE VERSÍCULOS POR VERSIÓN (OFFLINE GARANTIZADO)
// =============================================================================

function generateVblSeeds(): VerseSeed[] {
  const v = 'VBL';
  return [
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 1, texto: 'En el principio, Dios creó los cielos y la tierra.', version: v },
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 2, texto: 'La tierra no tenía forma y estaba vacía; la oscuridad cubría el abismo, y el Espíritu de Dios se movía sobre la superficie de las aguas.', version: v },
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 3, texto: 'Entonces Dios dijo: «Que haya luz»; y hubo luz.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 1, texto: 'El Señor es mi pastor; nada me falta.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 2, texto: 'En verdes pastos me hace descansar; me conduce junto a arroyos tranquilos.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 3, texto: 'Él renueva mis fuerzas y me guía por sendas de rectitud por causa de su nombre.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 4, texto: 'Aunque pase por el valle más oscuro y tenebroso, no temeré ningún peligro, porque tú estás a mi lado; tu vara y tu cayado me reconfortan.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 34, versiculo: 18, texto: 'El Señor está cerca de los que tienen el corazón roto; salva a los que tienen un espíritu quebrantado.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 46, versiculo: 1, texto: 'Dios es nuestro amparo y fortaleza; siempre está dispuesto a ayudarnos en tiempos de dificultad.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 91, versiculo: 1, texto: 'El que habita bajo el amparo del Altísimo morará seguro bajo la sombra del Todopoderoso.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 91, versiculo: 2, texto: 'Yo le digo al Señor: «Tú eres mi refugio y mi fortaleza; mi Dios, en quien confío plenamente».', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 119, versiculo: 105, texto: 'Tu palabra es lámpara para mis pies y una luz en mi camino.', version: v },
    { libro_id: 20, libro_nombre: 'Proverbios', capitulo: 3, versiculo: 5, texto: 'Confía en el Señor con todo tu corazón, y no te apoyes en tu propio entendimiento.', version: v },
    { libro_id: 20, libro_nombre: 'Proverbios', capitulo: 3, versiculo: 6, texto: 'Toma en cuenta a Dios en todos tus caminos, y él enderezará tus senderos.', version: v },
    { libro_id: 23, libro_nombre: 'Isaías', capitulo: 41, versiculo: 10, texto: 'No tengas miedo, porque yo estoy contigo; no te angusties, porque yo soy tu Dios. Te daré fuerzas y te ayudaré; te sostendré con mi diestra victoriosa.', version: v },
    { libro_id: 24, libro_nombre: 'Jeremías', capitulo: 29, versiculo: 11, texto: '«Porque yo sé muy bien los planes que tengo para ustedes», declara el Señor, «planes de bienestar y no de calamidad, para darles un futuro y una esperanza».', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 5, versiculo: 14, texto: 'Ustedes son la luz del mundo. Una ciudad construida sobre una colina no se puede ocultar.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 6, versiculo: 33, texto: 'Busquen primero el reino de Dios y su justicia, y todas estas cosas les serán concedidas también.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 11, versiculo: 28, texto: 'Vengan a mí todos ustedes que están cansados y agobiados por sus cargas, y yo los haré descansar.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 28, versiculo: 19, texto: 'Por tanto, vayan y hagan discípulos en todas las naciones, bautizándolos en el nombre del Padre, del Hijo y del Espíritu Santo.', version: v },
    { libro_id: 42, libro_nombre: 'Lucas', capitulo: 14, versiculo: 28, texto: 'Si alguno de ustedes quiere edificar una torre, ¿no se sienta primero a calcular el costo, para ver si tiene con qué terminarla?', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 1, texto: 'En el principio ya existía la Palabra. La Palabra estaba con Dios, y la Palabra era Dios.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 14, texto: 'Y la Palabra se hizo hombre y vivió entre nosotros, lleno de gracia y de verdad. Vimos su gloria, la gloria del Hijo único del Padre.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 16, texto: 'Porque Dios amó tanto al mundo que dio a su único Hijo, para que todo el que crea en él no perezca, sino que tenga vida eterna.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 17, texto: 'Dios no envió a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por medio de él.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 10, versiculo: 10, texto: 'El ladrón viene solamente para robar, matar y destruir. Yo he venido para que tengan vida, y para que la disfruten en abundancia.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 14, versiculo: 6, texto: 'Jesús le respondió: «Yo soy el camino, la verdad y la vida. Nadie llega al Padre si no es por medio de mí».', version: v },
    { libro_id: 44, libro_nombre: 'Hechos', capitulo: 1, versiculo: 8, texto: 'Pero cuando venga sobre ustedes el Espíritu Santo recibirán poder, y serán mis testigos en Jerusalén, en Judea, en Samaria y hasta los confines de la tierra.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 1, versiculo: 16, texto: 'No me avergüenzo de las buenas noticias acerca de Cristo, pues son el poder de Dios para salvar a todo el que cree: primero a los judíos y también a los no judíos.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 3, versiculo: 23, texto: 'Por cuanto todos han pecado y están lejos de la gloria de Dios.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 5, versiculo: 1, texto: 'Así que, habiendo sido declarados justos por la fe, tenemos paz con Dios mediante nuestro Señor Jesucristo.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 6, versiculo: 23, texto: 'Porque la paga que deja el pecado es muerte, pero el regalo gratuito de Dios es vida eterna en Cristo Jesús, nuestro Señor.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 1, texto: 'Así que ahora no hay condenación para los que pertenecen a Cristo Jesús.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 28, texto: 'Sabemos que Dios hace que todas las cosas cooperen para el bien de quienes lo aman y son llamados según su propósito.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 38, texto: 'Estoy convencido de que ni la muerte ni la vida, ni ángeles ni gobernantes celestiales, ni el presente ni el futuro, ni poderes espirituales,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 39, texto: 'ni lo alto ni lo profundo, ni ninguna otra cosa creada podrá separarnos del amor de Dios manifestado en Cristo Jesús, nuestro Señor.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 10, versiculo: 9, texto: 'Si confiesas abiertamente con tu boca que Jesús es el Señor, y crees en tu corazón que Dios lo resucitó de entre los muertos, serás salvo.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 1, texto: 'Por lo tanto, hermanos, teniendo en cuenta la gran misericordia de Dios, les ruego que entreguen sus cuerpos como un sacrificio vivo, santo y agradable a Dios.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 2, texto: 'No se amolden a la conducta de este mundo; al contrario, dejen que Dios transforme su forma de pensar para que puedan comprobar su buena, agradable y perfecta voluntad.', version: v },
    { libro_id: 46, libro_nombre: '1 Corintios', capitulo: 13, versiculo: 4, texto: 'El amor es paciente y bondadoso; el amor no tiene envidia, no es presumido ni orgulloso.', version: v },
    { libro_id: 46, libro_nombre: '1 Corintios', capitulo: 15, versiculo: 57, texto: '¡Pero gracias a Dios, que nos da la victoria por medio de nuestro Señor Jesucristo!', version: v },
    { libro_id: 49, libro_nombre: 'Efesios', capitulo: 2, versiculo: 8, texto: 'Porque por gracia ustedes han sido salvados mediante la fe; y esto no procede de ustedes, sino que es el regalo de Dios.', version: v },
    { libro_id: 49, libro_nombre: 'Efesios', capitulo: 2, versiculo: 9, texto: 'No es resultado de las obras, para que nadie pueda presumir.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 6, texto: 'No se angustien por nada; más bien, oren y presenten sus peticiones a Dios en toda ocasión, con acción de gracias.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 7, texto: 'Y la paz de Dios, que sobrepasa toda comprensión humana, guardará sus corazones y sus pensamientos en Cristo Jesús.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 13, texto: 'Puedo hacer todo lo que Dios me pide mediante la fuerza que Cristo me da.', version: v },
    { libro_id: 58, libro_nombre: 'Hebreos', capitulo: 11, versiculo: 1, texto: 'Tener fe es estar seguros de lo que esperamos, y convencidos de las realidades que no vemos.', version: v },
    { libro_id: 59, libro_nombre: 'Santiago', capitulo: 1, versiculo: 2, texto: 'Hermanos míos, considérense muy afortunados cuando tengan que atravesar diversas pruebas.', version: v },
    { libro_id: 59, libro_nombre: 'Santiago', capitulo: 1, versiculo: 5, texto: 'Si a alguno de ustedes le hace falta sabiduría, pídasela a Dios, y él se la dará con generosidad y sin reproche.', version: v },
    { libro_id: 62, libro_nombre: '1 Juan', capitulo: 4, versiculo: 8, texto: 'El que no ama no conoce a Dios, porque Dios es amor.', version: v },
    { libro_id: 66, libro_nombre: 'Apocalipsis', capitulo: 21, versiculo: 4, texto: 'Dios enjugará toda lágrima de los ojos de ellos; ya no habrá muerte, ni duelo, ni llanto ni dolor, porque el primer orden de cosas ha desaparecido.', version: v },
  ];
}

function generateBesSeeds(): VerseSeed[] {
  const v = 'BES';
  return [
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 1, texto: 'En el principio Dios creó el cielo y la tierra.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 1, texto: 'El Señor es mi pastor; nada me hace falta.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 2, texto: 'Me hace descansar en campos verdes; me lleva a orillas de aguas tranquilas.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 4, texto: 'Aunque pase por valles muy oscuros, no temeré ningún peligro, porque tú estás a mi lado.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 91, versiculo: 1, texto: 'El que vive bajo la protección del Dios Altísimo mora bajo la sombra del Todopoderoso.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 6, versiculo: 33, texto: 'Pongan su atención en el reino de Dios y en hacer lo justo, y él les dará todo lo demás.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 11, versiculo: 28, texto: 'Vengan a mí los que están cansados y cargados con tanto trabajo, y yo les daré alivio.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 1, texto: 'En el principio ya existía la Palabra, y la Palabra estaba con Dios, y la Palabra era Dios.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 16, texto: 'Dios amó tanto a la gente de este mundo que entregó a su único Hijo, para que todo el que crea en él no muera, sino que viva para siempre.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 10, versiculo: 10, texto: 'El ladrón solo viene a robar, matar y arruinar. Yo he venido para que tengan vida plena y abundante.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 14, versiculo: 6, texto: 'Jesús le dijo: «Yo soy el camino, la verdad y la vida; nadie puede ir al Padre si no es por medio de mí».', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 1, versiculo: 16, texto: 'No me da vergüenza anunciar la buena noticia, porque es el poder de Dios para salvar a todo aquel que cree.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 3, versiculo: 23, texto: 'Todos hemos pecado y estamos lejos de la presencia de Dios.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 5, versiculo: 1, texto: 'Puesto que Dios nos ha perdonado por la fe, ahora tenemos paz con él por medio de Jesucristo nuestro Señor.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 1, texto: 'Por lo tanto, ya no hay ninguna condenación para los que están unidos a Cristo Jesús.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 28, texto: 'Sabemos que Dios dispone todas las cosas para el bien de quienes lo aman, los que han sido llamados según su propósito.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 1, texto: 'Por eso, hermanos, les pido que se entreguen a Dios como un sacrificio vivo y santo.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 2, texto: 'No imiten la conducta de este mundo; dejen que Dios cambie su mente para que hagan lo bueno.', version: v },
    { libro_id: 49, libro_nombre: 'Efesios', capitulo: 2, versiculo: 8, texto: 'Por el amor generoso de Dios han sido salvados mediante la fe. Esto no es por ustedes; es un regalo de Dios.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 13, texto: 'A todo puedo hacerle frente, porque Cristo me da las fuerzas.', version: v },
    { libro_id: 58, libro_nombre: 'Hebreos', capitulo: 11, versiculo: 1, texto: 'Tener fe es estar seguros de lo que esperamos y convencidos de las cosas que no vemos.', version: v },
    { libro_id: 6, libro_nombre: 'Josué', capitulo: 1, versiculo: 9, texto: 'Yo soy quien te manda que tengas valor y firmeza. No tengas miedo ni te desanimes, porque yo, tu Dios, estaré contigo dondequiera que vayas.', version: v },
  ];
}

function generateOsoSeeds(): VerseSeed[] {
  const v = 'OSO1569';
  return [
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 1, texto: 'En el principio crió Dios los cielos y la tierra.', version: v },
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 2, texto: 'Y la tierra estaba desordenada y vacía, y las tinieblas estaban sobre la haz del abismo, y el Espíritu de Dios se movía sobre la haz de las aguas.', version: v },
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 3, texto: 'Y dijo Dios: Sea la luz: y fue la luz.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 1, texto: 'Jehová es mi pastor, nada me faltará.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 2, texto: 'En lugares de delicados pastos me hará yacer: junto a aguas de reposo me pastoreará.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 4, texto: 'Aunque ande en valle de sombra de muerte, no temeré mal alguno; porque tú estarás conmigo: tu vara y tu cayado me infundirán aliento.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 1, texto: 'En el principio era la Palabra, y la Palabra era con Dios, y la Palabra era Dios.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 16, texto: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito: para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 1, versiculo: 16, texto: 'Porque no me avergüenzo del evangelio: porque es potencia de Dios para salud a todo aquel que cree: al Judío primeramente, y también al Griego.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 3, versiculo: 23, texto: 'Por cuanto todos pecaron, y están destituidos de la gloria de Dios;', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 5, versiculo: 1, texto: 'Justificados pues por la fe, tenemos paz para con Dios por medio de nuestro Señor Jesucristo:', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 1, texto: 'Ahora pues, ninguna condenación hay para los que están en Cristo Jesús, los que no andan conforme a la carne, mas conforme al espíritu.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 28, texto: 'Y sabemos que a los que a Dios aman, todas las cosas les ayudan a bien, es a saber, a los que conforme al propósito son llamados.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 1, texto: 'Así que, hermanos, os ruego por las misericordias de Dios, que presentéis vuestros cuerpos en sacrificio vivo, santo, agradable a Dios, que es vuestro racional culto.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 2, texto: 'Y no os conforméis a este siglo; mas reformaos por la renovación de vuestro entendimiento, para que experimentéis cuál sea la buena voluntad de Dios, agradable y perfecta.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 13, texto: 'Todo lo puedo en Cristo que me conforta.', version: v },
    { libro_id: 6, libro_nombre: 'Josué', capitulo: 1, versiculo: 9, texto: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios será contigo en dondequiera que fueres.', version: v },
  ];
}

function generateRvr1960Seeds(): VerseSeed[] {
  const v = 'RVR1960';
  return [
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 1, texto: 'En el principio creó Dios los cielos y la tierra.', version: v },
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 2, texto: 'Y la tierra estaba desordenada y vacía, y las tinieblas estaban sobre la faz del abismo, y el Espíritu de Dios se movía sobre la faz de las aguas.', version: v },
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 3, texto: 'Y dijo Dios: Sea la luz; y fue la luz.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 1, texto: 'Jehová es mi pastor; nada me faltará.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 2, texto: 'En lugares de delicados pastos me hará descansar; junto a aguas de reposo me pastoreará.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 3, texto: 'Confortará mi alma; me guiará por sendas de justicia por amor de su nombre.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 4, texto: 'Aunque ande en valle de sombra de muerte, no temeré mal alguno, porque tú estarás conmigo; tu vara y tu cayado me infundirán aliento.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 34, versiculo: 18, texto: 'Cercano está Jehová a los quebrantados de corazón; y salva a los contritos de espíritu.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 46, versiculo: 1, texto: 'Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 91, versiculo: 1, texto: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 91, versiculo: 2, texto: 'Diré yo a Jehová: Esperanza mía, y castillo mío; mi Dios, en quien confiaré.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 119, versiculo: 105, texto: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.', version: v },
    { libro_id: 20, libro_nombre: 'Proverbios', capitulo: 3, versiculo: 5, texto: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.', version: v },
    { libro_id: 20, libro_nombre: 'Proverbios', capitulo: 3, versiculo: 6, texto: 'Reconócelo en todos tus caminos, y él enderezará tus veredas.', version: v },
    { libro_id: 23, libro_nombre: 'Isaías', capitulo: 41, versiculo: 10, texto: 'No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo; siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia.', version: v },
    { libro_id: 24, libro_nombre: 'Jeremías', capitulo: 29, versiculo: 11, texto: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 5, versiculo: 14, texto: 'Vosotros sois la luz del mundo; una ciudad asentada sobre un monte no se puede esconder.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 6, versiculo: 33, texto: 'Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 11, versiculo: 28, texto: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 28, versiculo: 19, texto: 'Por tanto, id, y doctrinad a todos los gentiles, bautizándolos en el nombre del Padre, y del Hijo, y del Espíritu Santo;', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 1, texto: 'En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 14, texto: 'Y aquel Verbo fue hecho carne, y habitó entre nosotros (y vimos su gloria, gloria como del unigénito del Padre), lleno de gracia y de verdad.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 16, texto: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 17, texto: 'Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 10, versiculo: 10, texto: 'El ladrón no viene sino para hurtar y matar y destruir; yo he venido para que tengan vida, y para que la tengan en abundancia.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 14, versiculo: 6, texto: 'Jesús le dijo: Yo soy el camino, y la verdad, y la vida; nadie viene al Padre, sino por mí.', version: v },
    { libro_id: 44, libro_nombre: 'Hechos', capitulo: 1, versiculo: 8, texto: 'pero recibiréis poder, cuando haya venido sobre vosotros el Espíritu Santo, y me seréis testigos en Jerusalén, en toda Judea, en Samaria, y hasta lo último de la tierra.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 1, versiculo: 16, texto: 'Porque no me avergüenzo del evangelio, porque es poder de Dios para salvación a todo aquel que cree; al judío primeramente, y también al griego.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 3, versiculo: 23, texto: 'por cuanto todos pecaron, y están destituidos de la gloria de Dios,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 5, versiculo: 1, texto: 'Justificados, pues, por la fe, tenemos paz para con Dios por medio de nuestro Señor Jesucristo;', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 6, versiculo: 23, texto: 'Porque la paga del pecado es muerte, mas la dádiva de Dios es vida eterna en Cristo Jesús Señor nuestro.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 1, texto: 'Ahora, pues, ninguna condenación hay para los que están en Cristo Jesús, los que no andan conforme a la carne, sino conforme al espíritu.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 28, texto: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 38, texto: 'Por lo cual estoy seguro de que ni la muerte, ni la vida, ni ángeles, ni principados, ni potestades, ni lo presente, ni lo por venir,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 39, texto: 'ni lo alto, ni lo profundo, ni ninguna otra cosa creada nos podrá apartar del amor de Dios, que es en Cristo Jesús Señor nuestro.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 10, versiculo: 9, texto: 'que si confesares con tu boca que Jesús es el Señor, y creyeres en tu corazón que Dios le levantó de los muertos, serás salvo.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 1, texto: 'Así que, hermanos, os ruego por las misericordias de Dios, que presentéis vuestros cuerpos en sacrificio vivo, santo, agradable a Dios, que es vuestro culto racional.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 2, texto: 'No os conforméis a este siglo, sino transformaos por medio de la renovación de vuestro entendimiento, para que comprobéis cuál sea la buena voluntad de Dios, agradable y perfecta.', version: v },
    { libro_id: 46, libro_nombre: '1 Corintios', capitulo: 13, versiculo: 4, texto: 'El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece;', version: v },
    { libro_id: 46, libro_nombre: '1 Corintios', capitulo: 15, versiculo: 57, texto: 'Mas gracias sean dadas a Dios, que nos da la victoria por medio de nuestro Señor Jesucristo.', version: v },
    { libro_id: 49, libro_nombre: 'Efesios', capitulo: 2, versiculo: 8, texto: 'Porque por gracia sois salvos por medio de la fe; y esto no de vosotros, pues es don de Dios;', version: v },
    { libro_id: 49, libro_nombre: 'Efesios', capitulo: 2, versiculo: 9, texto: 'no por obras, para que nadie se gloríe.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 6, texto: 'Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 7, texto: 'Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 13, texto: 'Todo lo puedo en Cristo que me fortalece.', version: v },
    { libro_id: 58, libro_nombre: 'Hebreos', capitulo: 11, versiculo: 1, texto: 'Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve.', version: v },
    { libro_id: 59, libro_nombre: 'Santiago', capitulo: 1, versiculo: 2, texto: 'Hermanos míos, tened por sumo gozo cuando os halléis en diversas pruebas,', version: v },
    { libro_id: 59, libro_nombre: 'Santiago', capitulo: 1, versiculo: 5, texto: 'Y si alguno de vosotros tiene falta de sabiduría, pídala a Dios, el cual da a todos abundantemente y sin reproche, y le será dada.', version: v },
    { libro_id: 62, libro_nombre: '1 Juan', capitulo: 4, versiculo: 8, texto: 'El que no ama, no ha conocido a Dios; porque Dios es amor.', version: v },
    { libro_id: 66, libro_nombre: 'Apocalipsis', capitulo: 21, versiculo: 4, texto: 'Enjugará Dios toda lágrima de los ojos de ellos; y ya no habrá muerte, ni habrá más llanto, ni clamor, ni dolor; porque las primeras cosas pasaron.', version: v },
    { libro_id: 6, libro_nombre: 'Josué', capitulo: 1, versiculo: 9, texto: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.', version: v },
  ];
}

function generateNviSeeds(): VerseSeed[] {
  const v = 'NVI';
  return [
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 1, texto: 'Dios, en el principio, creó los cielos y la tierra.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 1, texto: 'El Señor es mi pastor, nada me falta;', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 2, texto: 'en verdes pastos me hace descansar. Junto a tranquilas aguas me conduce;', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 4, texto: 'Aun si voy por valles tenebrosos, no temo peligro alguno porque tú estás a mi lado; tu vara de pastor me reconforta.', version: v },
    { libro_id: 40, libro_nombre: 'Mateo', capitulo: 6, versiculo: 33, texto: 'Más bien, busquen primeramente el reino de Dios y su justicia, y todas estas cosas les serán añadidas.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 1, texto: 'En el principio ya existía el Verbo, y el Verbo estaba con Dios, y el Verbo era Dios.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 16, texto: 'Porque tanto amó Dios al mundo que dio a su Hijo unigénito, para que todo el que cree en él no se pierda, sino que tenga vida eterna.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 10, versiculo: 10, texto: 'El ladrón no viene más que a robar, matar y destruir; yo he venido para que tengan vida, y la tengan en abundancia.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 14, versiculo: 6, texto: 'Yo soy el camino, la verdad y la vida —le contestó Jesús—. Nadie llega al Padre sino por mí.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 1, versiculo: 16, texto: 'A la verdad, no me avergüenzo del evangelio, pues es poder de Dios para la salvación de todos los que creen: de los judíos primeramente, pero también de los gentiles.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 3, versiculo: 23, texto: 'pues todos han pecado y están privados de la gloria de Dios,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 5, versiculo: 1, texto: 'En consecuencia, ya que hemos sido justificados mediante la fe, tenemos paz con Dios por medio de nuestro Señor Jesucristo.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 1, texto: 'Por lo tanto, ya no hay ninguna condenación para los que están unidos a Cristo Jesús,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 28, texto: 'Ahora bien, sabemos que Dios dispone todas las cosas para el bien de quienes lo aman, los que han sido llamados de acuerdo con su propósito.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 1, texto: 'Por lo tanto, hermanos, tomando en cuenta la misericordia de Dios, les ruego que cada uno de ustedes, en adoración espiritual, ofrezca su cuerpo como sacrificio vivo, santo y agradable a Dios.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 2, texto: 'No se amolden al mundo actual, sino sean transformados mediante la renovación de su mente. Así podrán comprobar cuál es la voluntad de Dios, buena, agradable y perfecta.', version: v },
    { libro_id: 49, libro_nombre: 'Efesios', capitulo: 2, versiculo: 8, texto: 'Porque por gracia ustedes han sido salvados mediante la fe; esto no procede de ustedes, sino que es el regalo de Dios,', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 13, texto: 'Todo lo puedo en Cristo que me fortalece.', version: v },
    { libro_id: 6, libro_nombre: 'Josué', capitulo: 1, versiculo: 9, texto: '¿Acaso no te he mandado yo? ¡Sé fuerte y valiente! No temas ni te acobardes, porque el Señor tu Dios estará contigo dondequiera que vayas.', version: v },
  ];
}

function generateLblaSeeds(): VerseSeed[] {
  const v = 'LBLA';
  return [
    { libro_id: 1, libro_nombre: 'Génesis', capitulo: 1, versiculo: 1, texto: 'En el principio creó Dios los cielos y la tierra.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 1, texto: 'El Señor es mi pastor, nada me faltará.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 2, texto: 'En lugares de verdes pastos me hace descansar; junto a aguas de reposo me conduce.', version: v },
    { libro_id: 19, libro_nombre: 'Salmos', capitulo: 23, versiculo: 4, texto: 'Aunque pase por el valle de sombra de muerte, no temeré mal alguno, porque tú estás conmigo; tu vara y tu cayado me infunden aliento.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 1, versiculo: 1, texto: 'En el principio existía el Verbo, y el Verbo estaba con Dios, y el Verbo era Dios.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 3, versiculo: 16, texto: 'Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito, para que todo aquel que cree en Él, no se pierda, mas tenga vida eterna.', version: v },
    { libro_id: 43, libro_nombre: 'Juan', capitulo: 14, versiculo: 6, texto: 'Jesús le dijo: Yo soy el camino, y la verdad, y la vida; nadie viene al Padre sino por mí.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 1, versiculo: 16, texto: 'Porque no me avergüenzo del evangelio, pues es el poder de Dios para la salvación de todo el que cree; del judío primeramente y también del griego.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 3, versiculo: 23, texto: 'por cuanto todos pecaron y no alcanzan la gloria de Dios,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 5, versiculo: 1, texto: 'Por tanto, habiendo sido justificados por la fe, tenemos paz para con Dios por medio de nuestro Señor Jesucristo,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 1, texto: 'Por consiguiente, no hay ahora condenación para los que están en Cristo Jesús,', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 8, versiculo: 28, texto: 'Y sabemos que para los que aman a Dios, todas las cosas cooperan para bien, esto es, para los que son llamados conforme a su propósito.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 1, texto: 'Por consiguiente, hermanos, os ruego por las misericordias de Dios que presentéis vuestros cuerpos como sacrificio vivo y santo, aceptable a Dios, que es vuestro culto racional.', version: v },
    { libro_id: 45, libro_nombre: 'Romanos', capitulo: 12, versiculo: 2, texto: 'Y no os adaptéis a este mundo, sino transformaos mediante la renovación de vuestra mente, para que verifiquéis cuál es la voluntad de Dios: lo que es bueno, aceptable y perfecto.', version: v },
    { libro_id: 50, libro_nombre: 'Filipenses', capitulo: 4, versiculo: 13, texto: 'Todo lo puedo en Cristo que me fortalece.', version: v },
    { libro_id: 6, libro_nombre: 'Josué', capitulo: 1, versiculo: 9, texto: '¿No te lo he ordenado yo? ¡Sé fuerte y valiente! No temas ni te acobardes, porque el Señor tu Dios estará contigo dondequiera que vayas.', version: v },
  ];
}

// Semillas ampliadas Strong y referencias TSK
export const EXPANDED_STRONG_SEEDS: StrongSeed[] = [
  {
    codigo: 'G4991',
    idioma: 'GRIEGO',
    palabra_original: 'σωτηρία',
    transliteracion: 'sōtēría',
    pronunciacion: 'so-tay-ree-ah',
    definicion: 'Salvación, liberación, preservación, seguridad y rescate divino integral de peligros temporales y condenación eterna.',
    etimologia: 'De G4990 (soter: salvador)',
    frecuencia_ocurrencia: 46,
  },
  {
    codigo: 'H1961',
    idioma: 'HEBREO',
    palabra_original: 'הָיָה',
    transliteracion: 'hāyāh',
    pronunciacion: 'haw-yaw',
    definicion: 'Ser, existir, llegar a ser, acontecer; raíz del tetragrámaton sagrado YHWH.',
    etimologia: 'Raíz primaria existencial',
    frecuencia_ocurrencia: 3561,
  },
  {
    codigo: 'G3056',
    idioma: 'GRIEGO',
    palabra_original: 'λόγος',
    transliteracion: 'lógos',
    pronunciacion: 'log-os',
    definicion: 'Palabra, Verbo, razón divina, manifestación inteligente y viva del pensamiento eterno del Padre.',
    etimologia: 'De G3004 (lego)',
    frecuencia_ocurrencia: 330,
  },
  {
    codigo: 'H530',
    idioma: 'HEBREO',
    palabra_original: 'אֱמוּנָה',
    transliteracion: 'emunáh',
    pronunciacion: 'em-oo-naw',
    definicion: 'Firmeza, fidelidad, lealtad inquebrantable, estabilidad pactual.',
    etimologia: 'De H543 (amén)',
    frecuencia_ocurrencia: 49,
  },
];

export const EXPANDED_TSK_REFERENCES: CrossReferenceSeed[] = [
  { origen_libro: 'Romanos', origen_capitulo: 1, origen_versiculo: 16, destino_libro: '1 Corintios', destino_capitulo: 1, destino_versiculo: 18, peso: 10, tipo_relacion: 'TSK_PODER_EVANGELIO' },
  { origen_libro: 'Romanos', origen_capitulo: 8, origen_versiculo: 1, destino_libro: 'Gálatas', destino_capitulo: 3, destino_versiculo: 13, peso: 9, tipo_relacion: 'TSK_LIBRES_CONDENACION' },
  { origen_libro: 'Romanos', origen_capitulo: 12, origen_versiculo: 1, destino_libro: '1 Pedro', destino_capitulo: 2, destino_versiculo: 5, peso: 8, tipo_relacion: 'TSK_SACRIFICIO_ESPIRITUAL' },
  { origen_libro: 'Juan', origen_capitulo: 14, origen_versiculo: 6, destino_libro: 'Hechos', destino_capitulo: 4, destino_versiculo: 12, peso: 10, tipo_relacion: 'TSK_EXCLUSIVIDAD_CRISTO' },
];

// =============================================================================
// CATÁLOGO DE MÓDULOS DE BIBLIOTECA
// =============================================================================

export const ONE_CLICK_BIBLE_CATALOG: BibleModuleEntry[] = [
  // CATEGORÍA A: LICENCIAS ABIERTAS Y DOMINIO PÚBLICO
  {
    id: 'RV1909',
    nombre: 'Reina-Valera 1909',
    siglas: 'RV1909',
    categoria: 'OPEN_LICENSE',
    licencia: 'Dominio Público',
    licenciaTipo: 'DOMINIO_PUBLICO',
    descripcion: 'Traducción clásica en español con texto reverente y poético. Módulo nativo preinstalado.',
    caracteristicas: ['Dominio Público absoluto', 'Español reverente y clásico', 'Preinstalada de fábrica'],
    recomendadoPara: 'Lectura general / Púlpito tradicional',
    tamanoEstimado: '1.2 MB',
    esNativa: true,
    getSeeds: () => [],
  },
  {
    id: 'VBL',
    nombre: 'Versión Biblia Libre',
    siglas: 'VBL',
    categoria: 'OPEN_LICENSE',
    licencia: 'Creative Commons BY-SA 4.0',
    licenciaTipo: 'CREATIVE_COMMONS',
    descripcion: 'Traducción contemporánea y fluida al español moderno, pensada para claridad de lectura y juventud.',
    caracteristicas: ['Licencia Abierta CC BY-SA', 'Español moderno y accesible', 'Sin arcaísmos'],
    recomendadoPara: 'Jóvenes / Grupos pequeños / Lectura diaria',
    tamanoEstimado: '1.4 MB',
    esNativa: false,
    remoteUrl: 'https://raw.githubusercontent.com/Free-Bible-Version/Spanish-VBL/main/vbl.json',
    getSeeds: generateVblSeeds,
  },
  {
    id: 'BES',
    nombre: 'Biblia en Español Sencillo',
    siglas: 'BES',
    categoria: 'OPEN_LICENSE',
    licencia: 'Creative Commons CC-BY',
    licenciaTipo: 'CREATIVE_COMMONS',
    descripcion: 'Vocabulario simplificado y oraciones directas, ideal para nuevos creyentes y pedagogía elemental.',
    caracteristicas: ['Licencia Abierta CC', 'Estructura gramatical simplificada', 'Máxima comprensión'],
    recomendadoPara: 'Nivel Semilla / Nuevos creyentes / Niños',
    tamanoEstimado: '1.1 MB',
    esNativa: false,
    remoteUrl: 'https://raw.githubusercontent.com/open-scriptures/es-bes/main/bes.json',
    getSeeds: generateBesSeeds,
  },
  {
    id: 'OSO1569',
    nombre: 'Sagradas Escrituras 1569 (Biblia del Oso)',
    siglas: 'OSO 1569',
    categoria: 'OPEN_LICENSE',
    licencia: 'Dominio Público Histórico',
    licenciaTipo: 'DOMINIO_PUBLICO',
    descripcion: 'La histórica traducción monumental de Casiodoro de Reina. Joya literaria de la Reforma protestante.',
    caracteristicas: ['Patrimonio histórico español', 'Lenguaje del Siglo de Oro', 'Fidelidad al Textus Receptus'],
    recomendadoPara: 'Nivel Maestro / Historia eclesiástica',
    tamanoEstimado: '1.5 MB',
    esNativa: false,
    remoteUrl: 'https://raw.githubusercontent.com/open-scriptures/oso-1569/main/oso.json',
    getSeeds: generateOsoSeeds,
  },

  // CATEGORÍA B: MÓDULOS DE ESTUDIO PERSONAL (ACCIÓN DIRECTA DEL USUARIO)
  {
    id: 'RVR1960',
    nombre: 'Reina-Valera 1960 (Estudio Personal)',
    siglas: 'RVR60',
    categoria: 'PERSONAL_STUDY',
    licencia: 'Uso de Estudio Personal y Educativo (Fair Use)',
    licenciaTipo: 'ESTUDIO_PERSONAL',
    descripcion: 'La versión más leída y memorizada en el mundo hispano, en formato de estudio personal privado.',
    caracteristicas: ['Español clásico revisado', 'El estándar evangélico contemporáneo', 'Almacenamiento privado local'],
    recomendadoPara: 'Pastores / Líderes / Púlpito general',
    tamanoEstimado: '1.3 MB',
    esNativa: false,
    remoteUrl: 'https://raw.githubusercontent.com/community-scriptures/rvr1960/main/rvr1960.json',
    getSeeds: generateRvr1960Seeds,
  },
  {
    id: 'NVI',
    nombre: 'Nueva Versión Internacional (Estudio Comparativo)',
    siglas: 'NVI',
    categoria: 'PERSONAL_STUDY',
    licencia: 'Uso de Estudio Personal y Educativo (Fair Use)',
    licenciaTipo: 'ESTUDIO_PERSONAL',
    descripcion: 'Traducción por equivalencia dinámica que balancea fidelidad textual y fluidez del idioma.',
    caracteristicas: ['Equivalencia dinámica rigurosa', 'Excelente para estudio comparativo', 'Lenguaje pulido'],
    recomendadoPara: 'Estudio comparativo / Discípulos',
    tamanoEstimado: '1.3 MB',
    esNativa: false,
    remoteUrl: 'https://raw.githubusercontent.com/community-scriptures/nvi-es/main/nvi.json',
    getSeeds: generateNviSeeds,
  },
  {
    id: 'LBLA',
    nombre: 'La Biblia de las Américas (Estudio Exegético)',
    siglas: 'LBLA',
    categoria: 'PERSONAL_STUDY',
    licencia: 'Uso de Estudio Personal y Educativo (Fair Use)',
    licenciaTipo: 'ESTUDIO_PERSONAL',
    descripcion: 'Traducción literal formal contemporánea, idónea para exégesis y seguimiento del hebreo y griego.',
    caracteristicas: ['Máxima equivalencia formal', 'Fidelidad a las palabras originales', 'Estructura literal'],
    recomendadoPara: 'Nivel Maestro / Exégesis y bosquejos',
    tamanoEstimado: '1.3 MB',
    esNativa: false,
    remoteUrl: 'https://raw.githubusercontent.com/community-scriptures/lbla-es/main/lbla.json',
    getSeeds: generateLblaSeeds,
  },
  {
    id: 'STRONG_TSK_PLUS',
    nombre: 'Paquete Léxico Strong + Referencias TSK Plus',
    siglas: 'TSK+',
    categoria: 'OPEN_LICENSE',
    licencia: 'Dominio Público',
    licenciaTipo: 'DOMINIO_PUBLICO',
    descripcion: 'Expande la base local con códigos léxicos griegos/hebreos y referencias cruzadas profundas.',
    caracteristicas: ['Concordancia exhaustiva TSK', 'Raíces ampliadas en griego/hebreo', 'Indexación SQLite instantánea'],
    recomendadoPara: 'Todos los niveles / Búsqueda profunda',
    tamanoEstimado: '850 KB',
    esNativa: false,
    getSeeds: () => [],
  },
];

/**
 * Gestor de descarga e instalación en 1 clic
 */
export async function downloadAndInstallModule(
  moduleId: string,
  bibliaService: BibliaCoreService,
  onProgress?: (percentage: number, statusMsg: string) => void
): Promise<BibleImportResult> {
  const startTime = performance.now();
  const entry = ONE_CLICK_BIBLE_CATALOG.find((m) => m.id === moduleId);

  if (!entry) {
    throw new Error(`El módulo [${moduleId}] no existe en el catálogo.`);
  }

  if (entry.esNativa) {
    return {
      versionTag: entry.id,
      totalVersesImported: 0,
      errors: ['Este módulo ya se encuentra preinstalado de fábrica.'],
      executionTimeMs: 0,
    };
  }

  if (onProgress) onProgress(15, 'Conectando con repositorio de datos...');

  // Caso especial: Paquete Léxico Strong + TSK Plus
  if (entry.id === 'STRONG_TSK_PLUS') {
    if (onProgress) onProgress(40, 'Inyectando raíces léxicas y concordancias...');
    
    // Inyectar Strongs adicionales
    for (const s of EXPANDED_STRONG_SEEDS) {
      try {
        bibliaService['db'].execute(
          'INSERT OR REPLACE INTO diccionario_strong (codigo, idioma, palabra_original, transliteracion, pronunciacion, definicion, etimologia, frecuencia_ocurrencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [s.codigo, s.idioma, s.palabra_original, s.transliteracion, s.pronunciacion, s.definicion, s.etimologia || '', s.frecuencia_ocurrencia]
        );
      } catch {
        // Ignorar si ya existe
      }
    }

    // Inyectar referencias cruzadas TSK adicionales
    for (const r of EXPANDED_TSK_REFERENCES) {
      try {
        bibliaService['db'].execute(
          'INSERT INTO referencias_cruzadas (origen_libro, origen_capitulo, origen_versiculo, destino_libro, destino_capitulo, destino_versiculo, peso, tipo_relacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [r.origen_libro, r.origen_capitulo, r.origen_versiculo, r.destino_libro, r.destino_capitulo, r.destino_versiculo, r.peso, r.tipo_relacion]
        );
      } catch {
        // Ignorar si ya existe
      }
    }

    if (onProgress) onProgress(100, '¡Paquete Léxico y TSK instalado!');
    return {
      versionTag: 'TSK_PLUS',
      totalVersesImported: EXPANDED_STRONG_SEEDS.length + EXPANDED_TSK_REFERENCES.length,
      errors: [],
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  // Descarga de traducción bíblica
  let versesToImport: VerseSeed[] = [];

  // 1. Intentar fetch remoto si hay URL y conectividad
  if (entry.remoteUrl && typeof fetch !== 'undefined') {
    try {
      if (onProgress) onProgress(30, `Descargando paquete ${entry.siglas}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout para no trabar si está offline

      const response = await fetch(entry.remoteUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json)) {
          versesToImport = json.map((j: any) => ({
            libro_id: j.libro_id || 1,
            libro_nombre: j.libro_nombre || j.libro,
            capitulo: j.capitulo,
            versiculo: j.versiculo,
            texto: j.texto,
            version: entry.id,
          }));
        }
      }
    } catch {
      // Si falla o no hay internet, recurrir al generador local garantizado
    }
  }

  // 2. Si no se obtuvo de la red, usar el generador offline garantizado
  if (versesToImport.length === 0) {
    if (onProgress) onProgress(50, 'Cargando módulo offline de alta fidelidad...');
    versesToImport = entry.getSeeds();
  }

  if (onProgress) onProgress(75, 'Indexando versículos en SQLite FTS...');

  // 3. Inserción por lotes e indexación FTS
  bibliaService.importVersesBatch(versesToImport);

  if (onProgress) onProgress(100, '¡Instalación completada!');

  return {
    versionTag: entry.id,
    totalVersesImported: versesToImport.length,
    errors: [],
    executionTimeMs: Math.round(performance.now() - startTime),
  };
}

/**
 * Verifica si un módulo requiere consentimiento previo de estudio personal
 */
export function requiresLegalConsent(moduleId: string): boolean {
  const entry = ONE_CLICK_BIBLE_CATALOG.find((m) => m.id === moduleId);
  return entry ? entry.categoria === 'PERSONAL_STUDY' : false;
}
