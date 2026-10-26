import { CANONICAL_BOOKS_CATALOG } from './canonicalBooks.js';

export interface CanonicalBookSeed {
  id: number;
  testamento: 'AT' | 'NT';
  nombre: string;
  abreviatura: string;
  capitulos: number;
}

export interface VerseSeed {
  libro_id: number;
  libro_nombre: string;
  capitulo: number;
  versiculo: number;
  texto: string;
  version: string;
}

export interface CrossReferenceSeed {
  origen_libro: string;
  origen_capitulo: number;
  origen_versiculo: number;
  destino_libro: string;
  destino_capitulo: number;
  destino_versiculo: number;
  peso: number;
  tipo_relacion: string;
}

export interface StrongSeed {
  codigo: string;
  idioma: 'HEBREO' | 'GRIEGO' | 'ARAMEO';
  palabra_original: string;
  transliteracion: string;
  pronunciacion: string;
  definicion: string;
  etimologia?: string;
  frecuencia_ocurrencia: number;
}

/**
 * Catálogo canónico completo de los 66 libros de la Biblia (39 AT + 27 NT)
 */
export const CANONICAL_BOOKS: CanonicalBookSeed[] = CANONICAL_BOOKS_CATALOG.map((b) => ({
  id: b.id,
  testamento: b.testamento,
  nombre: b.nombre,
  abreviatura: b.abreviatura,
  capitulos: b.capitulos,
}));

export const CORE_VERSES_RV1909: VerseSeed[] = [
  // Génesis 1
  {
    libro_id: 1,
    libro_nombre: 'Génesis',
    capitulo: 1,
    versiculo: 1,
    texto: 'EN el principio crió Dios los cielos y la tierra.',
    version: 'RV1909',
  },
  {
    libro_id: 1,
    libro_nombre: 'Génesis',
    capitulo: 1,
    versiculo: 2,
    texto: 'Y la tierra estaba desordenada y vacía, y las tinieblas estaban sobre la haz del abismo, y el Espíritu de Dios se movía sobre la haz de las aguas.',
    version: 'RV1909',
  },
  {
    libro_id: 1,
    libro_nombre: 'Génesis',
    capitulo: 1,
    versiculo: 3,
    texto: 'Y dijo Dios: Sea la luz: y fué la luz.',
    version: 'RV1909',
  },
  // Génesis 50 (Providencia Soberana)
  {
    libro_id: 1,
    libro_nombre: 'Génesis',
    capitulo: 50,
    versiculo: 20,
    texto: 'Vosotros pensasteis mal sobre mí, mas Dios lo encaminó á bien, para hacer lo que vemos hoy, para mantener en vida á mucho pueblo.',
    version: 'RV1909',
  },
  // Salmos 23
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 23,
    versiculo: 1,
    texto: 'JEHOVA es mi pastor; nada me faltará.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 23,
    versiculo: 2,
    texto: 'En lugares de delicados pastos me hará yacer: Junto á aguas de reposo me pastoreará.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 23,
    versiculo: 3,
    texto: 'Confortará mi alma; Guiárame por sendas de justicia por amor de su nombre.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 23,
    versiculo: 4,
    texto: 'Aunque ande en valle de sombra de muerte, No temeré mal alguno; porque tú estarás conmigo: Tu vara y tu cayado me infundirán aliento.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 23,
    versiculo: 5,
    texto: 'Aderezarás mesa delante de mí en presencia de mis angustiadores: Ungiste mi cabeza con aceite; mi copa está rebosando.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 23,
    versiculo: 6,
    texto: 'Ciertamente el bien y la misericordia me seguirán todos los días de mi vida: Y en la casa de Jehová moraré por largos días.',
    version: 'RV1909',
  },
  // Salmos 34
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 34,
    versiculo: 18,
    texto: 'Cercano está Jehová á los quebrantados de corazón; Y salvará á los contritos de espíritu.',
    version: 'RV1909',
  },
  // Salmos 119
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 119,
    versiculo: 105,
    texto: 'LÁMPARA es á mis pies tu palabra, Y lumbrera á mi camino.',
    version: 'RV1909',
  },
  // Proverbios 3
  {
    libro_id: 20,
    libro_nombre: 'Proverbios',
    capitulo: 3,
    versiculo: 5,
    texto: 'Fíate de Jehová de todo tu corazón, Y no te apoyes en tu propia prudencia.',
    version: 'RV1909',
  },
  {
    libro_id: 20,
    libro_nombre: 'Proverbios',
    capitulo: 3,
    versiculo: 6,
    texto: 'Reconócelo en todos tus caminos, Y él enderezará tus veredas.',
    version: 'RV1909',
  },
  // Isaías 41
  {
    libro_id: 23,
    libro_nombre: 'Isaías',
    capitulo: 41,
    versiculo: 10,
    texto: 'No temas, que yo soy contigo; no desmayes, que yo soy tu Dios que te esfuerzo: siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia.',
    version: 'RV1909',
  },
  // Jeremías 29
  {
    libro_id: 24,
    libro_nombre: 'Jeremías',
    capitulo: 29,
    versiculo: 11,
    texto: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.',
    version: 'RV1909',
  },
  // Mateo 11
  {
    libro_id: 40,
    libro_nombre: 'Mateo',
    capitulo: 11,
    versiculo: 28,
    texto: 'Venid á mí todos los que estáis trabajados y cargados, que yo os haré descansar.',
    version: 'RV1909',
  },
  // Juan 1
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 1,
    versiculo: 1,
    texto: 'EN el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.',
    version: 'RV1909',
  },
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 1,
    versiculo: 14,
    texto: 'Y aquel Verbo fué hecho carne, y habitó entre nosotros (y vimos su gloria, gloria como del unigénito del Padre), lleno de gracia y de verdad.',
    version: 'RV1909',
  },
  // Juan 3
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 3,
    versiculo: 16,
    texto: 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
    version: 'RV1909',
  },
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 3,
    versiculo: 17,
    texto: 'Porque no envió Dios á su Hijo al mundo para que condene al mundo, mas para que el mundo sea salvo por él.',
    version: 'RV1909',
  },
  // Juan 10 (El Buen Pastor)
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 10,
    versiculo: 11,
    texto: 'Yo soy el buen pastor: el buen pastor su vida da por las ovejas.',
    version: 'RV1909',
  },
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 10,
    versiculo: 14,
    texto: 'Yo soy el buen pastor; y conozco mis ovejas, y las mías me conocen,',
    version: 'RV1909',
  },
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 10,
    versiculo: 27,
    texto: 'Mis ovejas oyen mi voz, y yo las conozco, y me siguen;',
    version: 'RV1909',
  },
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 10,
    versiculo: 28,
    texto: 'Y yo les doy vida eterna y no perecerán para siempre, ni nadie las arrebatará de mi mano.',
    version: 'RV1909',
  },
  // Romanos 3
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 3,
    versiculo: 23,
    texto: 'Por cuanto todos pecaron, y están destituidos de la gloria de Dios;',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 3,
    versiculo: 24,
    texto: 'Siendo justificados gratuitamente por su gracia por la redención que es en Cristo Jesús;',
    version: 'RV1909',
  },
  // Romanos 4
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 4,
    versiculo: 3,
    texto: 'Porque ¿qué dice la Escritura? Y creyó Abraham á Dios, y le fué atribuído á justicia.',
    version: 'RV1909',
  },
  // Romanos 5
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 5,
    versiculo: 8,
    texto: 'Mas Dios encarece su caridad para con nosotros, porque siendo aún pecadores, Cristo murió por nosotros.',
    version: 'RV1909',
  },
  // Romanos 8
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 1,
    texto: 'AHORA pues, ninguna condenación hay para los que están en Cristo Jesús, los que no andan conforme á la carne, mas conforme al espíritu.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 28,
    texto: 'Y sabemos que á los que á Dios aman, todas las cosas les ayudan á bien, es á saber, á los que conforme al propósito son llamados.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 31,
    texto: '¿Pues qué diremos á esto? Si Dios por nosotros, ¿quién contra nosotros?',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 38,
    texto: 'Por lo cual estoy cierto que ni la muerte, ni la vida, ni ángeles, ni principados, ni potestades, ni lo presente, ni lo por venir,',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 39,
    texto: 'Ni lo alto, ni lo bajo, ni ninguna criatura nos podrá apartar del amor de Dios, que es en Cristo Jesús Señor nuestro.',
    version: 'RV1909',
  },
  // Efesios 2
  {
    libro_id: 49,
    libro_nombre: 'Efesios',
    capitulo: 2,
    versiculo: 8,
    texto: 'Porque por gracia sois salvos por la fe; y esto no de vosotros, pues es don de Dios:',
    version: 'RV1909',
  },
  {
    libro_id: 49,
    libro_nombre: 'Efesios',
    capitulo: 2,
    versiculo: 9,
    texto: 'No por obras, para que nadie se gloríe.',
    version: 'RV1909',
  },
  // Filipenses 4
  {
    libro_id: 50,
    libro_nombre: 'Filipenses',
    capitulo: 4,
    versiculo: 6,
    texto: 'Por nada estéis afanosos; sino sean notorias vuestras peticiones delante de Dios en toda oración y ruego, con hacimiento de gracias.',
    version: 'RV1909',
  },
  {
    libro_id: 50,
    libro_nombre: 'Filipenses',
    capitulo: 4,
    versiculo: 7,
    texto: 'Y la paz de Dios, que sobrepuja todo entendimiento, guardará vuestros corazones y vuestros entendimientos en Cristo Jesús.',
    version: 'RV1909',
  },
  {
    libro_id: 50,
    libro_nombre: 'Filipenses',
    capitulo: 4,
    versiculo: 13,
    texto: 'Todo lo puedo en Cristo que me fortalece.',
    version: 'RV1909',
  },
  {
    libro_id: 50,
    libro_nombre: 'Filipenses',
    capitulo: 4,
    versiculo: 19,
    texto: 'Mi Dios, pues, suplirá todo lo que os falta conforme á sus riquezas en gloria en Cristo Jesús.',
    version: 'RV1909',
  },
  // 2 Corintios 12
  {
    libro_id: 47,
    libro_nombre: '2 Corintios',
    capitulo: 12,
    versiculo: 9,
    texto: 'Y me ha dicho: Bástate mi gracia; porque mi potencia en la flaqueza se perfecciona. Por tanto, de buena gana me gloriaré más bien en mis flaquezas, porque habite en mí la potencia de Cristo.',
    version: 'RV1909',
  },
  // Romanos 5
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 5,
    versiculo: 1,
    texto: 'JUSTIFICADOS pues por la fe, tenemos paz para con Dios por medio de nuestro Señor Jesucristo:',
    version: 'RV1909',
  },
  // Mateo 6
  {
    libro_id: 40,
    libro_nombre: 'Mateo',
    capitulo: 6,
    versiculo: 33,
    texto: 'Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.',
    version: 'RV1909',
  },
  // Salmos 46
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 46,
    versiculo: 1,
    texto: 'DIOS es nuestro amparo y fortaleza, Nuestro pronto auxilio en las tribulaciones.',
    version: 'RV1909',
  },
  // 1 Juan 4
  {
    libro_id: 62,
    libro_nombre: '1 Juan',
    capitulo: 4,
    versiculo: 8,
    texto: 'El que no ama, no conoce á Dios; porque Dios es amor.',
    version: 'RV1909',
  },
  {
    libro_id: 62,
    libro_nombre: '1 Juan',
    capitulo: 4,
    versiculo: 9,
    texto: 'En esto se mostró el amor de Dios para con nosotros, en que Dios envió á su Hijo unigénito al mundo, para que vivamos por él.',
    version: 'RV1909',
  },
  // 1 Pedro 2
  {
    libro_id: 60,
    libro_nombre: '1 Pedro',
    capitulo: 2,
    versiculo: 24,
    texto: 'El cual mismo llevó nuestros pecados en su cuerpo sobre el madero, para que nosotros siendo muertos á los pecados, vivamos á la justicia: por la herida del cual habéis sido sanados.',
    version: 'RV1909',
  },
  {
    libro_id: 60,
    libro_nombre: '1 Pedro',
    capitulo: 2,
    versiculo: 25,
    texto: 'Porque vosotros erais como ovejas descarriadas; mas ahora habéis vuelto al Pastor y Obispo de vuestras almas.',
    version: 'RV1909',
  },
  // Apocalipsis 21
  {
    libro_id: 66,
    libro_nombre: 'Apocalipsis',
    capitulo: 21,
    versiculo: 4,
    texto: 'Y limpiará Dios toda lágrima de los ojos de ellos; y la muerte no será más; y no habrá más llanto, ni clamor, ni dolor: porque las primeras cosas son pasadas.',
    version: 'RV1909',
  },
  // Éxodo 3
  {
    libro_id: 2,
    libro_nombre: 'Éxodo',
    capitulo: 3,
    versiculo: 14,
    texto: 'Y respondió Dios á Moisés: YO SOY EL QUE SOY. Y dijo: Así dirás á los hijos de Israel: YO SOY me ha enviado á vosotros.',
    version: 'RV1909',
  },
  // Éxodo 20
  {
    libro_id: 2,
    libro_nombre: 'Éxodo',
    capitulo: 20,
    versiculo: 2,
    texto: 'Yo soy JEHOVA tu Dios, que te saqué de la tierra de Egipto, de casa de siervos.',
    version: 'RV1909',
  },
  {
    libro_id: 2,
    libro_nombre: 'Éxodo',
    capitulo: 20,
    versiculo: 3,
    texto: 'No tendrás dioses ajenos delante de mí.',
    version: 'RV1909',
  },
  // Deuteronomio 6
  {
    libro_id: 5,
    libro_nombre: 'Deuteronomio',
    capitulo: 6,
    versiculo: 4,
    texto: 'Oye, Israel: Jehová nuestro Dios, Jehová uno es.',
    version: 'RV1909',
  },
  // Isaías 9
  {
    libro_id: 23,
    libro_nombre: 'Isaías',
    capitulo: 9,
    versiculo: 6,
    texto: 'Porque un niño nos es nacido, hijo nos es dado; y el principado sobre su hombro: y llamarase su nombre Admirable, Consejero, Dios fuerte, Padre eterno, Príncipe de paz.',
    version: 'RV1909',
  },
  // Isaías 53
  {
    libro_id: 23,
    libro_nombre: 'Isaías',
    capitulo: 53,
    versiculo: 5,
    texto: 'Mas él herido fué por nuestras rebeliones, molido por nuestros pecados: el castigo de nuestra paz sobre él; y por su llaga fuimos nosotros curados.',
    version: 'RV1909',
  },
  // Daniel 2
  {
    libro_id: 27,
    libro_nombre: 'Daniel',
    capitulo: 2,
    versiculo: 21,
    texto: 'Y él es el que muda los tiempos y las oportunidades: quita reyes, y pone reyes: da la sabiduría á los sabios, y la ciencia á los entendidos:',
    version: 'RV1909',
  },
  // Miqueas 6
  {
    libro_id: 33,
    libro_nombre: 'Miqueas',
    capitulo: 6,
    versiculo: 8,
    texto: 'Oh hombre, él te ha declarado qué sea lo bueno, y qué pida de ti Jehová: solamente hacer juicio, y amar misericordia, y humillarte para andar con tu Dios.',
    version: 'RV1909',
  },
  // Habacuc 2
  {
    libro_id: 35,
    libro_nombre: 'Habacuc',
    capitulo: 2,
    versiculo: 4,
    texto: 'He aquí se enorgullece aquel cuya alma no es derecha en él: mas el justo en su fe vivirá.',
    version: 'RV1909',
  },
  // Hechos 1
  {
    libro_id: 44,
    libro_nombre: 'Hechos',
    capitulo: 1,
    versiculo: 8,
    texto: 'Mas recibiréis la virtud del Espíritu Santo que vendrá sobre vosotros; y me seréis testigos en Jerusalem, y en toda Judea, y en Samaria, y hasta lo último de la tierra.',
    version: 'RV1909',
  },
  // 2 Timoteo 3
  {
    libro_id: 55,
    libro_nombre: '2 Timoteo',
    capitulo: 3,
    versiculo: 16,
    texto: 'Toda Escritura es inspirada divinamente y útil para enseñar, para redargüir, para corregir, para instituir en justicia,',
    version: 'RV1909',
  },
  // Hebreos 2
  {
    libro_id: 58,
    libro_nombre: 'Hebreos',
    capitulo: 2,
    versiculo: 14,
    texto: 'Así que, por cuanto los hijos participaron de carne y sangre, él también participó juntamente de lo mismo, para destruir por la muerte al que tenía el imperio de la muerte, es á saber, al diablo,',
    version: 'RV1909',
  },
  // Hebreos 11
  {
    libro_id: 58,
    libro_nombre: 'Hebreos',
    capitulo: 11,
    versiculo: 1,
    texto: 'ES pues la fe la sustancia de las cosas que se esperan, la demostración de las cosas que no se ven.',
    version: 'RV1909',
  },
  // Hebreos 12
  {
    libro_id: 58,
    libro_nombre: 'Hebreos',
    capitulo: 12,
    versiculo: 2,
    texto: 'Puestos los ojos en al autor y consumador de la fe, en Jesús; el cual, habiéndole sido propuesto gozo, sufrió la cruz, menospreciando la vergüenza, y sentóse á la diestra del trono de Dios.',
    version: 'RV1909',
  },
  // Hebreos 13 (El Gran Pastor)
  {
    libro_id: 58,
    libro_nombre: 'Hebreos',
    capitulo: 13,
    versiculo: 20,
    texto: 'Y el Dios de paz que sacó de los muertos á nuestro Señor Jesucristo, el gran pastor de las ovejas, por la sangre del testamento eterno,',
    version: 'RV1909',
  },
  // Apocalipsis 1
  {
    libro_id: 66,
    libro_nombre: 'Apocalipsis',
    capitulo: 1,
    versiculo: 8,
    texto: 'Yo soy el Alpha y la Omega, principio y fin, dice el Señor, que es y que era y que ha de venir, el Todopoderoso.',
    version: 'RV1909',
  },
  // 2 Reyes 4 (La viuda y las vasijas de aceite - Mayordomía de crisis y provisión)
  {
    libro_id: 12,
    libro_nombre: '2 Reyes',
    capitulo: 4,
    versiculo: 2,
    texto: 'Y Eliseo le dijo: ¿Qué te haré yo? Declárame qué tienes en casa. Y ella dijo: Tu sierva ninguna cosa tiene en casa, sino una botija de aceite.',
    version: 'RV1909',
  },
  {
    libro_id: 12,
    libro_nombre: '2 Reyes',
    capitulo: 4,
    versiculo: 7,
    texto: 'Vino ella luego, y contólo al varón de Dios, el cual dijo: Ve, y vende el aceite, y paga á tus acreedores; y tú y tus hijos vivid de lo que quedare.',
    version: 'RV1909',
  },
  // 1 Reyes 19 (Elías bajo el enebro - Agotamiento, depresión y cuidado compasivo)
  {
    libro_id: 11,
    libro_nombre: '1 Reyes',
    capitulo: 19,
    versiculo: 4,
    texto: 'Y él se fué por el desierto un día de camino, y vino y sentóse debajo de un enebro; y deseando morirse, dijo: Bástame ya, oh Jehová, quita mi alma; que no soy yo mejor que mis padres.',
    version: 'RV1909',
  },
  {
    libro_id: 11,
    libro_nombre: '1 Reyes',
    capitulo: 19,
    versiculo: 5,
    texto: 'Y echándose debajo del enebro, quedóse dormido: y he aquí luego un ángel que le tocó, y le dijo: Levántate, come.',
    version: 'RV1909',
  },
  // Josué 1 (Ánimo ante el miedo y la incertidumbre del futuro)
  {
    libro_id: 6,
    libro_nombre: 'Josué',
    capitulo: 1,
    versiculo: 9,
    texto: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios será contigo en donde quiera que fueres.',
    version: 'RV1909',
  },
  // Lucas 14 (Cálculo prudente de gastos)
  {
    libro_id: 42,
    libro_nombre: 'Lucas',
    capitulo: 14,
    versiculo: 28,
    texto: 'Porque ¿cuál de vosotros, queriendo edificar una torre, no se sienta primero y calcula los gastos, á ver si tiene lo que necesita para acabarla?',
    version: 'RV1909',
  },
  // Romanos (Versículos ampliados para homilética y teología de púlpito)
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 1,
    versiculo: 16,
    texto: 'Porque no me avergüenzo del evangelio: porque es potencia de Dios para salud á todo aquel que cree; al Judío primeramente y también al Griego.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 6,
    versiculo: 23,
    texto: 'Porque la paga del pecado es muerte: mas la gracia de Dios es vida eterna en Cristo Jesús Señor nuestro.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 1,
    texto: 'NINGUNA condenación hay pues ahora para los que están en Cristo Jesús, los que no andan conforme á la carne, mas conforme al espíritu.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 38,
    texto: 'Por lo cual estoy cierto que ni la muerte, ni la vida, ni ángeles, ni principados, ni potestades, ni lo presente, ni lo por venir,',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 8,
    versiculo: 39,
    texto: 'Ni lo alto, ni lo bajo, ni ninguna criatura nos podrá apartar del amor de Dios, que es en Cristo Jesús Señor nuestro.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 10,
    versiculo: 9,
    texto: 'Que si confesares con tu boca al Señor Jesús, y creyeres en tu corazón que Dios le levantó de los muertos, serás salvo.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 12,
    versiculo: 1,
    texto: 'ASI que, hermanos, os ruego por las misericordias de Dios, que presentéis vuestros cuerpos en sacrificio vivo, santo, agradable á Dios, que es vuestro racional culto.',
    version: 'RV1909',
  },
  {
    libro_id: 45,
    libro_nombre: 'Romanos',
    capitulo: 12,
    versiculo: 2,
    texto: 'Y no os conforméis á este siglo; mas reformaos por la renovación de vuestro entendimiento, para que experimentéis cuál sea la buena voluntad de Dios, agradable y perfecta.',
    version: 'RV1909',
  },
  // Juan
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 10,
    versiculo: 10,
    texto: 'El ladrón no viene sino para hurtar, y matar, y destruir: yo he venido para que tengan vida, y para que la tengan en abundancia.',
    version: 'RV1909',
  },
  {
    libro_id: 43,
    libro_nombre: 'Juan',
    capitulo: 14,
    versiculo: 6,
    texto: 'Jesús le dice: Yo soy el camino, y la verdad, y la vida: nadie viene al Padre, sino por mí.',
    version: 'RV1909',
  },
  // Mateo
  {
    libro_id: 40,
    libro_nombre: 'Mateo',
    capitulo: 5,
    versiculo: 14,
    texto: 'Vosotros sois la luz del mundo: una ciudad asentada sobre un monte no se puede esconder.',
    version: 'RV1909',
  },
  {
    libro_id: 40,
    libro_nombre: 'Mateo',
    capitulo: 28,
    versiculo: 19,
    texto: 'Por tanto, id, y doctrinad á todos los Gentiles, bautizándolos en el nombre del Padre, y del Hijo, y del Espíritu Santo:',
    version: 'RV1909',
  },
  // Salmos
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 91,
    versiculo: 1,
    texto: 'EL que habita al abrigo del Altísimo, Morará bajo la sombra del Omnipotente.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 91,
    versiculo: 2,
    texto: 'Diré yo de Jehová: Esperanza mía, y castillo mío; Mi Dios, en él confiaré.',
    version: 'RV1909',
  },
  {
    libro_id: 19,
    libro_nombre: 'Salmos',
    capitulo: 119,
    versiculo: 105,
    texto: 'Lámpara es á mis pies tu palabra, Y lumbrera á mi camino.',
    version: 'RV1909',
  },
  // 1 Corintios
  {
    libro_id: 46,
    libro_nombre: '1 Corintios',
    capitulo: 13,
    versiculo: 4,
    texto: 'La caridad es sufrida, es benigna; la caridad no tiene envidia, la caridad no hace sinrazón, no se ensancha;',
    version: 'RV1909',
  },
  {
    libro_id: 46,
    libro_nombre: '1 Corintios',
    capitulo: 15,
    versiculo: 57,
    texto: 'Mas á Dios gracias, que nos da la victoria por medio de nuestro Señor Jesucristo.',
    version: 'RV1909',
  },
  // Santiago
  {
    libro_id: 59,
    libro_nombre: 'Santiago',
    capitulo: 1,
    versiculo: 2,
    texto: 'Hermanos míos, tened por sumo gozo cuando cayereis en diversas tentaciones;',
    version: 'RV1909',
  },
  {
    libro_id: 59,
    libro_nombre: 'Santiago',
    capitulo: 1,
    versiculo: 5,
    texto: 'Y si alguno de vosotros tiene falta de sabiduría, demándela á Dios, el cual da á todos abundantemente, y no zahiere; y le será dada.',
    version: 'RV1909',
  },
];

export const TSK_CROSS_REFERENCES: CrossReferenceSeed[] = [
  // Conexión Génesis 1:1 con Juan 1:1 y Hebreos 11:3
  {
    origen_libro: 'Génesis',
    origen_capitulo: 1,
    origen_versiculo: 1,
    destino_libro: 'Juan',
    destino_capitulo: 1,
    destino_versiculo: 1,
    peso: 10,
    tipo_relacion: 'CREACION_LOGOS',
  },
  {
    origen_libro: 'Génesis',
    origen_capitulo: 1,
    origen_versiculo: 1,
    destino_libro: 'Hebreos',
    destino_capitulo: 11,
    destino_versiculo: 3,
    peso: 9,
    tipo_relacion: 'CREACION_FE',
  },
  // Juan 3:16 con Romanos 5:8 y 1 Juan 4:9
  {
    origen_libro: 'Juan',
    origen_capitulo: 3,
    origen_versiculo: 16,
    destino_libro: 'Romanos',
    destino_capitulo: 5,
    destino_versiculo: 8,
    peso: 10,
    tipo_relacion: 'AMOR_SACRIFICIO',
  },
  {
    origen_libro: 'Juan',
    origen_capitulo: 3,
    origen_versiculo: 16,
    destino_libro: '1 Juan',
    destino_capitulo: 4,
    destino_versiculo: 9,
    peso: 10,
    tipo_relacion: 'ENVIO_HIJO',
  },
  // Salmos 23:1 con Juan 10:11 (Buen Pastor)
  {
    origen_libro: 'Salmos',
    origen_capitulo: 23,
    origen_versiculo: 1,
    destino_libro: 'Juan',
    destino_capitulo: 10,
    destino_versiculo: 11,
    peso: 10,
    tipo_relacion: 'PASTOR_MESIANICO',
  },
  // Efesios 2:8 con Romanos 3:24
  {
    origen_libro: 'Efesios',
    origen_capitulo: 2,
    origen_versiculo: 8,
    destino_libro: 'Romanos',
    destino_capitulo: 3,
    destino_versiculo: 24,
    peso: 9,
    tipo_relacion: 'GRACIA_JUSTIFICACION',
  },
];

export const STRONG_DICTIONARY: StrongSeed[] = [
  {
    codigo: 'H1254',
    idioma: 'HEBREO',
    palabra_original: 'בָּרָא',
    transliteracion: 'bará',
    pronunciacion: 'baw-raw',
    definicion: 'Crear, formar, producir de la nada (acción soberana y exclusiva atribuida a la divinidad en el texto sagrado).',
    etimologia: 'Raíz primaria bíblica',
    frecuencia_ocurrencia: 54,
  },
  {
    codigo: 'H7225',
    idioma: 'HEBREO',
    palabra_original: 'רֵאשִׁית',
    transliteracion: 'reshíth',
    pronunciacion: 'ray-sheeth',
    definicion: 'Principio, primicias, comienzo en tiempo, lugar u orden de dignidad.',
    etimologia: 'De H7218 (rosh: cabeza)',
    frecuencia_ocurrencia: 51,
  },
  {
    codigo: 'H430',
    idioma: 'HEBREO',
    palabra_original: 'אֱלֹהִים',
    transliteracion: 'Elohím',
    pronunciacion: 'el-o-heem',
    definicion: 'Dios, el Supremo Gobernante, Ser Supremo. Plural de majestad y plenitud de atributos divinos.',
    etimologia: 'Plural de H433 (Eloah)',
    frecuencia_ocurrencia: 2606,
  },
  {
    codigo: 'H3068',
    idioma: 'HEBREO',
    palabra_original: 'יְהוָה',
    transliteracion: 'Yahweh / YHWH',
    pronunciacion: 'yeh-ho-vaw',
    definicion: 'El Autoexistente o Eterno; nombre propio sagrado e inefable del Dios verdadero de Israel en su pacto.',
    etimologia: 'De H1961 (hayah: ser, existir)',
    frecuencia_ocurrencia: 6519,
  },
  {
    codigo: 'G26',
    idioma: 'GRIEGO',
    palabra_original: 'ἀγάπη',
    transliteracion: 'agápē',
    pronunciacion: 'ag-ah-pay',
    definicion: 'Amor benevolente, incondicional, abnegado y sacrificial. No se basa en las emociones, sino en una decisión voluntaria de buscar el bien sumo del amado.',
    etimologia: 'De G25 (agapao)',
    frecuencia_ocurrencia: 116,
  },
  {
    codigo: 'G3056',
    idioma: 'GRIEGO',
    palabra_original: 'λόγος',
    transliteracion: 'lógos',
    pronunciacion: 'log-os',
    definicion: 'Palabra, Verbo, declaración inteligente, discurso, expresión de la mente y voluntad divina encarnada en Jesucristo.',
    etimologia: 'De G3004 (lego: hablar sistemáticamente)',
    frecuencia_ocurrencia: 330,
  },
  {
    codigo: 'G5485',
    idioma: 'GRIEGO',
    palabra_original: 'χάρις',
    transliteracion: 'cháris',
    pronunciacion: 'khar-ece',
    definicion: 'Gracia, favor inmerecido, benevolencia generosa de Dios hacia el hombre indigno por medio de Cristo.',
    etimologia: 'De G5463 (chairo: regocijarse)',
    frecuencia_ocurrencia: 156,
  },
  {
    codigo: 'G4102',
    idioma: 'GRIEGO',
    palabra_original: 'πίστις',
    transliteracion: 'pístis',
    pronunciacion: 'pis-tis',
    definicion: 'Fe, convicción firme, confianza inquebrantable, fidelidad absoluta a la verdad y promesa revelada.',
    etimologia: 'De G3982 (peitho: persuadir)',
    frecuencia_ocurrencia: 244,
  },
  {
    codigo: 'G4151',
    idioma: 'GRIEGO',
    palabra_original: 'πνεῦμα',
    transliteracion: 'pneûma',
    pronunciacion: 'pnyoo-mah',
    definicion: 'Espíritu, aliento de vida, viento, la tercera persona de la Trinidad (el Espíritu Santo).',
    etimologia: 'De G4154 (pneo: soplar)',
    frecuencia_ocurrencia: 385,
  },
  {
    codigo: 'H7965',
    idioma: 'HEBREO',
    palabra_original: 'שָׁלוֹם',
    transliteracion: 'shalóm',
    pronunciacion: 'shaw-lome',
    definicion: 'Paz, plenitud, integridad, bienestar total, salud, prosperidad espiritual y reconciliación pactual.',
    etimologia: 'De H7999 (shalam: estar completo o en reposo)',
    frecuencia_ocurrencia: 236,
  },
  {
    codigo: 'H2617',
    idioma: 'HEBREO',
    palabra_original: 'חֶסֶד',
    transliteracion: 'chésed',
    pronunciacion: 'kheh-sed',
    definicion: 'Misericordia, amor leal e inquebrantable de pacto, fidelidad bondadosa de Dios hacia su pueblo.',
    etimologia: 'De H2616 (chasad: inclinarse con bondad)',
    frecuencia_ocurrencia: 248,
  },
  {
    codigo: 'G1515',
    idioma: 'GRIEGO',
    palabra_original: 'εἰρήνη',
    transliteracion: 'eirḗnē',
    pronunciacion: 'i-ray-nay',
    definicion: 'Paz, reposo mesiánico, serenidad interior, estado de concordia y armonía con Dios por medio de Cristo.',
    etimologia: 'De G1417 (eiro: unir lo separado)',
    frecuencia_ocurrencia: 92,
  },
  {
    codigo: 'G2222',
    idioma: 'GRIEGO',
    palabra_original: 'ζωή',
    transliteracion: 'zōḗ',
    pronunciacion: 'dzo-ay',
    definicion: 'Vida eterna, la vida increada de Dios en plenitud, vida incorruptible que Cristo imparte al creyente.',
    etimologia: 'De G2198 (zao: vivir verdaderamente)',
    frecuencia_ocurrencia: 135,
  },
  {
    codigo: 'G1343',
    idioma: 'GRIEGO',
    palabra_original: 'δικαιοσύνη',
    transliteracion: 'dikaiosýnē',
    pronunciacion: 'dik-ah-yos-oo-nay',
    definicion: 'Justicia, condición recta ante Dios, justificación judicial impartida por la fe en Jesucristo.',
    etimologia: 'De G1342 (dikaios: justo)',
    frecuencia_ocurrencia: 92,
  },
];
