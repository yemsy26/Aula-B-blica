/**
 * Catálogo doctrinal y biográfico verificado para el motor determinista.
 *
 * No sustituye la exégesis de un pasaje concreto. Sirve para responder
 * consultas directas con definiciones, citas y aplicaciones coherentes con
 * la tradición evangélica histórico-gramatical.
 */

export interface DoctrineEntry {
  id: string;
  title: string;
  aliases: string[];
  summary: string;
  keyVerses: string[];
  coreTruths: string[];
  misconceptions: string[];
  application: string[];
  advancedNote?: string;
}

export interface CharacterEntry {
  id: string;
  name: string;
  title: string;
  aliases: string[];
  keyVerses: string[];
  summary: string;
  faithMoments: string[];
  failures: string[];
  lessons: string[];
  christConnection: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const DOCTRINE_CATALOG: DoctrineEntry[] = [
  {
    id: 'trinidad',
    title: 'La Trinidad',
    aliases: ['trinidad', 'triuno', 'tres personas', 'padre hijo espiritu santo', 'deidad de cristo'],
    summary:
      'Dios es uno en esencia y tres en personas: Padre, Hijo y Espíritu Santo. Las tres personas son el mismo Dios, coeternas, consustanciales y distintas en su relación, no tres dioses ni tres modos sucesivos de una sola persona.',
    keyVerses: ['Mateo 28:19', '2 Corintios 13:14', 'Juan 1:1', 'Hechos 5:3-4', 'Deuteronomio 6:4'],
    coreTruths: [
      'La unidad de Dios es confesada desde Deuteronomio 6:4 y nunca se niega en el Nuevo Testamento.',
      'El Padre es llamado Dios, el Hijo es llamado Dios y el Espíritu Santo es llamado Dios.',
      'Las tres personas se distinguen: el Hijo ora al Padre y el Padre envía al Espíritu.',
      'La Trinidad no es una explicación filosófica añadida, sino la forma en que el canon describe la vida interna de Dios.',
    ],
    misconceptions: [
      'Modalismo: creer que Dios se disfraza sucesivamente como Padre, Hijo y Espíritu.',
      'Arrianismo: creer que el Hijo es una criatura o un dios menor.',
      'Triteísmo: creer que son tres dioses separados.',
      'Pensar que la Trinidad es una contradicción matemática (1+1+1=3); la fe cristiana confiesa una sola esencia y tres personas.',
    ],
    application: [
      'Ora al Padre, por medio del Hijo, en el poder del Espíritu.',
      'Recibe el bautismo y la comunión como actos trinitarios, no como rituales aislados.',
      'Vive la unidad de la iglesia como reflejo de la unidad de Dios.',
    ],
    advancedNote:
      'En el griego del Nuevo Testamento, «persona» se expresa con prósōpon (rostro/relación) y «esencia» con ousía. La formulación nicena distingue una ousía y tres hypóstasis.',
  },
  {
    id: 'justificacion',
    title: 'La justificación por la fe',
    aliases: ['justificacion', 'justificado', 'declarado justo', 'sola fide', 'fe y obras'],
    summary:
      'La justificación es el acto judicial por el cual Dios declara justo al pecador que cree en Cristo, no porque lo merezca, sino porque la justicia perfecta de Cristo le es imputada. Es por gracia, mediante la fe, para la gloria de Dios.',
    keyVerses: ['Romanos 3:24', 'Romanos 5:1', 'Efesios 2:8-9', 'Gálatas 2:16', '2 Corintios 5:21'],
    coreTruths: [
      'No es una infusión de justicia propia, sino una declaración forense basada en la obra de Cristo.',
      'La fe no es el mérito que compra la justificación; es el instrumento por el cual se recibe.',
      'Las obras son fruto y evidencia de la fe, nunca su causa.',
    ],
    misconceptions: [
      'Creer que se es justificado por cumplir la ley o por portarse bien.',
      'Creer que la fe es una emoción intensa o una experiencia mística sin contenido.',
      'Separar la justificación de la santificación y vivir en desobediencia deliberada.',
    ],
    application: [
      'Descansa en la obra terminada de Cristo y no en tu rendimiento espiritual.',
      'Confiesa el pecado sin negociar con la culpa; la condenación fue quitada en la cruz.',
      'Practica las obras como respuesta agradecida, no como pago de la salvación.',
    ],
    advancedNote:
      'Pablo usa dikaióō (declarar justo) en un contexto judicial, no transformativo. La imputación se apoya en Génesis 15:6 y en el paralelismo Adán/Cristo de Romanos 5.',
  },
  {
    id: 'santificacion',
    title: 'La santificación',
    aliases: ['santificacion', 'santidad', 'crecimiento cristiano', 'vivir en santidad'],
    summary:
      'La santificación es la obra progresiva del Espíritu Santo que transforma al creyente a la imagen de Cristo. Nace de la unión con Cristo y se expresa en obediencia, arrepentimiento y amor al prójimo.',
    keyVerses: ['Filipenses 2:12-13', '1 Tesalonicenses 4:3', 'Romanos 8:13', 'Gálatas 5:22-23', 'Hebreos 12:14'],
    coreTruths: [
      'Dios es quien produce el querer y el hacer (Filipenses 2:13).',
      'La santificación no es pasividad: exige cooperación responsable con la gracia.',
      'El fruto del Espíritu es carácter, no una lista de emociones religiosas.',
    ],
    misconceptions: [
      'Perfeccionismo: creer que el creyente puede alcanzar impecabilidad total en esta vida.',
      'Legalismo: reducir la santidad a reglas externas sin transformación del corazón.',
      'Antinomianismo: usar la gracia como excusa para seguir pecando.',
    ],
    application: [
      'Identifica un hábito concreto que el Espíritu te está confrontando y toma una medida esta semana.',
      'Practica disciplinas espirituales (oración, Escritura, comunión) como medios de gracia, no como méritos.',
      'Rinde cuentas a una comunidad de fe madura.',
    ],
  },
  {
    id: 'expiacion',
    title: 'La expiación de Cristo',
    aliases: ['expiacion', 'cruz', 'sacrificio de cristo', 'propiciacion', 'redención', 'redención'],
    summary:
      'La expiación es la obra de Cristo en la cruz por la cual satisface la justicia de Dios, lleva el pecado de su pueblo y reconcilia al pecador con el Padre. Es sustitutiva, suficiente y eficaz.',
    keyVerses: ['Isaías 53:5-6', 'Romanos 3:25', '1 Pedro 2:24', 'Hebreos 9:12', 'Colosenses 1:20'],
    coreTruths: [
      'Cristo murió en lugar del pecador, no solo como ejemplo moral.',
      'La cruz satisface la santidad de Dios y abre el acceso al Padre.',
      'La resurrección confirma que el sacrificio fue aceptado.',
    ],
    misconceptions: [
      'Reducir la cruz a un ejemplo de amor sin dimensión sacrificial.',
      'Creer que la sangre de Cristo solo borra pecados pasados y no transforma.',
      'Pensar que el ser humano puede añadir algo al sacrificio perfecto de Cristo.',
    ],
    application: [
      'Recibe el perdón con gratitud y sin volver a castigarte por lo que Dios ya perdonó.',
      'Perdona a otros desde la conciencia de haber sido perdonado.',
      'Proclama la cruz como el centro del evangelio, no como un símbolo decorativo.',
    ],
  },
  {
    id: 'resurreccion',
    title: 'La resurrección de Cristo',
    aliases: ['resurreccion', 'resucito', 'tumba vacia', 'vida eterna'],
    summary:
      'Jesucristo resucitó corporalmente al tercer día. La resurrección es un hecho histórico y el fundamento de la fe cristiana: garantiza la justificación, la esperanza de los creyentes y la victoria sobre la muerte.',
    keyVerses: ['1 Corintios 15:3-4', 'Romanos 4:25', '1 Pedro 1:3', 'Mateo 28:5-6', 'Juan 11:25'],
    coreTruths: [
      'La resurrección fue corporal, no solo espiritual o simbólica.',
      'Sin resurrección, la fe cristiana sería vana (1 Corintios 15:17).',
      'La resurrección inaugura la nueva creación y asegura la nuestra.',
    ],
    misconceptions: [
      'Creer que fue una alucinación colectiva o un mito.',
      'Reducirla a una metáfora de «seguir vivo en la memoria».',
      'Separar la resurrección de la cruz, como si una anulara la otra.',
    ],
    application: [
      'Vive con esperanza frente a la muerte y el duelo.',
      'Sirve con la energía de quien sabe que su trabajo en el Señor no es en vano.',
      'Anuncia la resurrección como buena noticia para un mundo que teme morir.',
    ],
  },
  {
    id: 'gracia',
    title: 'La gracia de Dios',
    aliases: ['gracia', 'favor inmerecido', 'charis', 'regalo de dios'],
    summary:
      'La gracia es el favor inmerecido de Dios hacia pecadores que no lo merecen. No es una fuerza impersonal, sino la acción misericordiosa del Dios trino que salva, sostiene y transforma.',
    keyVerses: ['Efesios 2:8-9', 'Tito 2:11-12', '2 Corintios 12:9', 'Romanos 5:20-21', 'Juan 1:16'],
    coreTruths: [
      'La gracia es gratuita para el pecador, pero no es barata: costó la cruz.',
      'La gracia verdadera enseña a renunciar a la impiedad (Tito 2:12).',
      'La gracia no depende del estado emocional ni del rendimiento del creyente.',
    ],
    misconceptions: [
      'Creer que la gracia es permiso para pecar.',
      'Creer que hay que ganarla con obras, penitencias o emociones intensas.',
      'Confundir gracia con debilidad o tolerancia sin verdad.',
    ],
    application: [
      'Recibe la gracia cada día y extiéndela a otros.',
      'Cuando falles, vuelve a la cruz antes de volver al autodesprecio.',
      'Sirve desde la aceptación, no para conseguir aceptación.',
    ],
  },
  {
    id: 'fe',
    title: 'La fe',
    aliases: ['fe', 'creer', 'confianza en dios', 'pistis'],
    summary:
      'La fe bíblica es confianza firme en Dios y en su promesa, basada en su carácter y en su Palabra. No es un salto ciego ni una emoción positiva, sino una convicción que produce obediencia.',
    keyVerses: ['Hebreos 11:1', 'Romanos 10:17', 'Santiago 2:17', 'Marcos 9:24', '2 Corintios 5:7'],
    coreTruths: [
      'La fe viene por oír la Palabra de Dios (Romanos 10:17).',
      'La fe verdadera produce frutos; no es solo una declaración verbal.',
      'La fe puede convivir con la duda y con la súplica «ayuda mi incredulidad».',
    ],
    misconceptions: [
      'Creer que la fe es un sentimiento o una energía positiva.',
      'Creer que dudar anula automáticamente la salvación.',
      'Usar la fe como fórmula mágica para obtener lo que se desea.',
    ],
    application: [
      'Alimenta tu fe con la Escritura, no solo con música o emociones.',
      'Actúa en obediencia pequeña y concreta mientras esperas claridad.',
      'Trae tus dudas a Dios con honestidad.',
    ],
  },
  {
    id: 'arrepentimiento',
    title: 'El arrepentimiento',
    aliases: ['arrepentimiento', 'arrepentirse', 'confesion', 'cambiar de vida'],
    summary:
      'El arrepentimiento es un cambio de mente y de dirección producido por la gracia: reconocer el pecado, abandonarlo y volverse a Dios. No es solo sentir culpa; incluye una nueva orientación de la vida.',
    keyVerses: ['Hechos 3:19', '2 Corintios 7:10', '1 Juan 1:9', 'Lucas 15:17-20', 'Salmos 51:1-4'],
    coreTruths: [
      'Hay tristeza según Dios que lleva al arrepentimiento, y tristeza mundana que lleva a la muerte.',
      'El arrepentimiento verdadero no negocia ni justifica el pecado.',
      'Dios recibe al que vuelve, no al que se queda en el remordimiento.',
    ],
    misconceptions: [
      'Confundir arrepentimiento con autodesprecio o penitencia infinita.',
      'Creer que hay que «sentir suficiente» para ser perdonado.',
      'Prometer cambiar sin tomar medidas concretas.',
    ],
    application: [
      'Nombra el pecado con honestidad delante de Dios.',
      'Repara el daño cuando sea posible y pide perdón a quien corresponda.',
      'Establece una medida concreta para no volver al mismo camino.',
    ],
  },
  {
    id: 'escritura',
    title: 'La suficiencia y autoridad de la Escritura',
    aliases: ['escritura', 'biblia', 'palabra de dios', 'inspiracion', 'sola scriptura', 'canon'],
    summary:
      'La Escritura es la Palabra de Dios inspirada, suficiente y autoritativa para la fe y la conducta. Es verdadera en todo lo que afirma y debe interpretarse en su contexto histórico-gramatical y en el conjunto del canon.',
    keyVerses: ['2 Timoteo 3:16-17', 'Salmos 119:105', 'Hebreos 4:12', 'Isaías 55:11', 'Josué 1:8'],
    coreTruths: [
      'Toda la Escritura es inspirada por Dios (theópneustos).',
      'La Escritura es suficiente para la salvación y la vida cristiana.',
      'El canon es la regla de fe; las experiencias personales se someten a él.',
    ],
    misconceptions: [
      'Creer que la Biblia solo contiene palabras de Dios mezcladas con errores humanos.',
      'Leer versículos aislados sin contexto ni género literario.',
      'Sustituir la Escritura por revelaciones privadas o modas culturales.',
    ],
    application: [
      'Lee la Biblia con un plan y en comunidad.',
      'Distingue entre el texto, la interpretación y la aplicación.',
      'Somete toda enseñanza a la totalidad del canon.',
    ],
    advancedNote:
      'Theópneustos (2 Timoteo 3:16) enfatiza que la Escritura es «exhalada por Dios». La doctrina de la inspiración no elimina el estilo de los autores humanos.',
  },
  {
    id: 'pacto',
    title: 'Los pactos bíblicos',
    aliases: ['pacto', 'alianza', 'pacto abrahamico', 'nuevo pacto', 'pacto mosaico', 'pacto davídico'],
    summary:
      'Dios se relaciona con su pueblo mediante pactos. Desde Noé y Abraham hasta el nuevo pacto en Cristo, la historia bíblica muestra un solo plan de redención: Dios promete, se compromete y cumple.',
    keyVerses: ['Génesis 12:1-3', 'Génesis 15:6', 'Jeremías 31:31-34', 'Lucas 22:20', 'Hebreos 8:6'],
    coreTruths: [
      'El pacto abrahámico es promesa y fe, no ley cumplida.',
      'El pacto mosaico revela la santidad de Dios y la incapacidad humana.',
      'El nuevo pacto cumple las promesas anteriores y es sellado con la sangre de Cristo.',
    ],
    misconceptions: [
      'Creer que el Antiguo Testamento enseña salvación por obras y el Nuevo por gracia.',
      'Reemplazar a Israel por la iglesia sin matices, o separar ambos de forma absoluta.',
      'Reducir el pacto a un contrato comercial.',
    ],
    application: [
      'Confía en las promesas de Dios aunque no veas el cumplimiento inmediato.',
      'Vive como miembro del pueblo del pacto, no como creyente aislado.',
      'Lee el Antiguo Testamento esperando su cumplimiento en Cristo.',
    ],
  },
  {
    id: 'providencia',
    title: 'La providencia divina',
    aliases: ['providencia', 'soberania', 'control de dios', 'plan de dios', 'voluntad de dios'],
    summary:
      'Dios gobierna toda la creación con sabiduría, poder y bondad. Nada escapa a su soberanía, pero eso no elimina la responsabilidad humana ni convierte a Dios en autor del pecado.',
    keyVerses: ['Romanos 8:28', 'Proverbios 16:9', 'Mateo 6:25-34', 'Génesis 50:20', 'Efesios 1:11'],
    coreTruths: [
      'Dios obra todas las cosas conforme al designio de su voluntad.',
      'La soberanía de Dios no anula la responsabilidad humana (Hechos 2:23).',
      'La providencia no siempre significa comodidad; a veces significa sostener en el dolor.',
    ],
    misconceptions: [
      'Fatalismo: creer que da igual lo que hagamos.',
      'Creer que todo sufrimiento es castigo directo por un pecado específico.',
      'Usar la soberanía para justificar la pasividad o la injusticia.',
    ],
    application: [
      'Entrega el resultado y asume la responsabilidad de tus decisiones.',
      'Busca la voluntad de Dios en la Escritura, no solo en señales.',
      'Confía en que Dios puede redimir incluso lo que otros hicieron para dañarte.',
    ],
  },
  {
    id: 'oracion',
    title: 'La oración',
    aliases: ['oracion', 'orar', 'rezar', 'comunicacion con dios', 'padrenuestro'],
    summary:
      'La oración es comunión con Dios: adoración, confesión, gratitud y petición. Se ofrece al Padre, por medio del Hijo, en el Espíritu Santo, y se apoya en la Escritura.',
    keyVerses: ['Mateo 6:9-13', 'Filipenses 4:6-7', '1 Tesalonicenses 5:17', 'Lucas 18:1', 'Santiago 5:16'],
    coreTruths: [
      'La oración no es un monólogo ni una fórmula para manipular a Dios.',
      'Dios escucha y responde según su sabiduría, no según nuestros caprichos.',
      'La oración transforma al que ora y lo alinea con la voluntad de Dios.',
    ],
    misconceptions: [
      'Creer que la oración es una técnica de visualización o de pensamiento positivo.',
      'Creer que hay que repetir palabras para ser escuchado.',
      'Abandonar la oración cuando no llega la respuesta esperada.',
    ],
    application: [
      'Reserva un tiempo diario, aunque sea breve, para orar con la Escritura.',
      'Lleva tus ansiedades a Dios con gratitud y peticiones concretas.',
      'Ora por otros, no solo por tus necesidades.',
    ],
  },
  {
    id: 'sufrimiento',
    title: 'El sufrimiento y la soberanía de Dios',
    aliases: ['sufrimiento', 'dolor', 'prueba', 'por que sufrimos', 'por que dios permite', 'mal'],
    summary:
      'La Biblia no niega el dolor ni lo explica con fórmulas simplistas. Afirma que Dios está presente en el sufrimiento, que lo usa para madurar nuestra fe y que un día lo eliminará por completo.',
    keyVerses: ['Job 42:5', 'Romanos 8:28', '2 Corintios 12:9', 'Salmos 34:18', 'Apocalipsis 21:4'],
    coreTruths: [
      'El sufrimiento no siempre es consecuencia directa de un pecado personal.',
      'Dios puede usar el dolor para profundizar la fe y consolar a otros.',
      'La esperanza cristiana no es evadir el dolor, sino atravesarlo con Dios.',
    ],
    misconceptions: [
      'Creer que todo el que sufre está siendo castigado.',
      'Creer que la fe verdadera elimina todo sufrimiento.',
      'Ofrecer respuestas fáciles a quien está en duelo.',
    ],
    application: [
      'Permite que la comunidad de fe te acompañe en el dolor.',
      'Lleva tu lamento a Dios con honestidad.',
      'Busca ayuda profesional cuando el sufrimiento afecte tu salud mental.',
    ],
  },
  {
    id: 'iglesia',
    title: 'La iglesia',
    aliases: ['iglesia', 'congregacion', 'cuerpo de cristo', 'comunidad de fe', 'ekklesia'],
    summary:
      'La iglesia es el pueblo de Dios convocado por el evangelio, el cuerpo de Cristo y el templo del Espíritu. No es un edificio, sino una comunidad de creyentes unidos por la fe, el bautismo y la comunión.',
    keyVerses: ['Mateo 16:18', 'Efesios 1:22-23', 'Hechos 2:42', '1 Corintios 12:12-14', 'Hebreos 10:24-25'],
    coreTruths: [
      'Cristo es la cabeza de la iglesia.',
      'La iglesia se reúne para enseñar, adorar, celebrar los sacramentos y servir.',
      'La unidad de la iglesia no es uniformidad, sino comunión en el evangelio.',
    ],
    misconceptions: [
      'Creer que la iglesia es solo un edificio o una organización humana.',
      'Creer que se puede ser cristiano sin comunidad.',
      'Confundir unidad con tolerancia a la falsa enseñanza.',
    ],
    application: [
      'Comprométete con una iglesia local y con su misión.',
      'Usa tus dones para servir, no solo para consumir.',
      'Busca la unidad sin sacrificar la verdad.',
    ],
  },
  {
    id: 'bautismo',
    title: 'El bautismo',
    aliases: ['bautismo', 'bautizar', 'bautismo en agua', 'bautismo del espiritu'],
    summary:
      'El bautismo es la señal visible de la unión con Cristo en su muerte y resurrección. No salva por sí mismo, pero es una respuesta obediente de fe y una declaración pública de pertenencia al pueblo de Dios.',
    keyVerses: ['Mateo 28:19', 'Romanos 6:3-4', 'Hechos 2:38', 'Colosenses 2:12', 'Gálatas 3:27'],
    coreTruths: [
      'El bautismo sigue a la fe y es una ordenanza de Cristo.',
      'Simboliza muerte al pecado y resurrección a una vida nueva.',
      'No reemplaza la fe ni el arrepentimiento.',
    ],
    misconceptions: [
      'Creer que el agua bautismal borra automáticamente el pecado.',
      'Creer que el bautismo es opcional para el discípulo.',
      'Convertirlo en un rito vacío sin discipulado.',
    ],
    application: [
      'Si has creído, considera el bautismo como tu siguiente paso de obediencia.',
      'Vive tu bautismo como una identidad, no solo como un recuerdo.',
      'Camina en una comunidad que te ayude a perseverar.',
    ],
  },
  {
    id: 'santa_cena',
    title: 'La Santa Cena',
    aliases: ['santa cena', 'comunion', 'eucaristia', 'cena del senor', 'pan y vino'],
    summary:
      'La Santa Cena es la ordenanza en la que la iglesia recuerda y proclama la muerte del Señor hasta que Él venga. El pan y el vino son señales de su cuerpo y su sangre, recibidas con fe, examen y gratitud.',
    keyVerses: ['Lucas 22:19-20', '1 Corintios 11:23-26', '1 Corintios 10:16-17', 'Juan 6:53-56'],
    coreTruths: [
      'Es memorial y proclamación de la cruz.',
      'Exige examen personal y reconciliación con el prójimo.',
      'Apunta hacia la venida futura de Cristo.',
    ],
    misconceptions: [
      'Creer que el pan y el vino se convierten físicamente en el cuerpo y la sangre de Cristo.',
      'Participar de forma superficial o sin examen.',
      'Convertirla en un espectáculo o en un requisito de mérito.',
    ],
    application: [
      'Examina tu corazón antes de participar.',
      'Reconcíliate con quienes estés en conflicto.',
      'Participa con gratitud y esperanza en la venida de Cristo.',
    ],
  },
  {
    id: 'evangelismo',
    title: 'La misión y el evangelismo',
    aliases: ['evangelismo', 'mision', 'gran comision', 'predicar el evangelio', 'testimonio'],
    summary:
      'La iglesia es enviada a hacer discípulos de todas las naciones, bautizándolos y enseñándoles a guardar todo lo que Cristo mandó. El evangelismo no es una tarea opcional, sino la misión central del pueblo de Dios.',
    keyVerses: ['Mateo 28:19-20', 'Hechos 1:8', 'Romanos 10:14-15', '2 Timoteo 4:2', '1 Pedro 3:15'],
    coreTruths: [
      'La misión nace del corazón de Dios y se extiende a todas las naciones.',
      'El evangelismo incluye proclamación, discipulado y servicio.',
      'El Espíritu Santo da poder y valentía para testificar.',
    ],
    misconceptions: [
      'Reducir la misión a una actividad de un departamento de la iglesia.',
      'Evangelizar sin discipular ni acompañar a los nuevos creyentes.',
      'Confundir proselitismo agresivo con testimonio amoroso.',
    ],
    application: [
      'Identifica a una persona por la que puedas orar y servir esta semana.',
      'Prepara una explicación sencilla y respetuosa de tu esperanza.',
      'Acompaña a los nuevos creyentes en su primer año de fe.',
    ],
  },
  {
    id: 'dones',
    title: 'Los dones espirituales',
    aliases: ['dones espirituales', 'dones del espiritu', 'carismas', 'servicio en la iglesia'],
    summary:
      'El Espíritu Santo distribuye dones a cada creyente para el bien común y la edificación de la iglesia. No son trofeos personales ni señales de superioridad espiritual.',
    keyVerses: ['1 Corintios 12:4-7', 'Romanos 12:6-8', 'Efesios 4:11-12', '1 Pedro 4:10-11'],
    coreTruths: [
      'Cada creyente tiene al menos un don.',
      'Los dones se ejercen para servir, no para lucirse.',
      'El amor es el camino más excelente para usar cualquier don (1 Corintios 13).',
    ],
    misconceptions: [
      'Creer que solo los líderes tienen dones.',
      'Buscar dones espectaculares y menospreciar los servicios ocultos.',
      'Usar los dones sin amor ni rendición de cuentas.',
    ],
    application: [
      'Pregunta a tu comunidad qué dones ven en ti.',
      'Sirve en un área concreta durante un periodo definido.',
      'Evalúa tu servicio por la edificación de otros, no por tu protagonismo.',
    ],
  },
  {
    id: 'escatologia',
    title: 'La esperanza escatológica',
    aliases: ['escatologia', 'fin del mundo', 'segunda venida', 'arrebatamiento', 'milenio', 'juicio final'],
    summary:
      'Cristo volverá visiblemente, resucitará a los muertos, juzgará al mundo y renovará la creación. La escatología bíblica produce esperanza, santidad y misión, no especulación morbosa ni fechas inventadas.',
    keyVerses: ['Mateo 24:36', '1 Tesalonicenses 4:16-17', 'Apocalipsis 21:1-4', 'Hechos 1:11', '2 Pedro 3:10-13'],
    coreTruths: [
      'Nadie conoce el día ni la hora.',
      'La venida de Cristo es una promesa segura.',
      'La esperanza cristiana incluye la resurrección del cuerpo y la nueva creación.',
    ],
    misconceptions: [
      'Predecir fechas o identificar al anticristo con personajes actuales sin base sólida.',
      'Reducir la escatología a un calendario de eventos.',
      'Vivir con miedo en lugar de esperanza.',
    ],
    application: [
      'Vive con sobriedad, santidad y misión.',
      'No dejes que la especulación te distraiga del amor al prójimo.',
      'Consuela a otros con la promesa de la resurrección.',
    ],
  },
  {
    id: 'matrimonio',
    title: 'El matrimonio',
    aliases: ['matrimonio', 'casamiento', 'esposo', 'esposa', 'familia', 'divorcio'],
    summary:
      'El matrimonio es una alianza entre un hombre y una mujer que refleja la relación de Cristo con su iglesia. Se caracteriza por el pacto, la fidelidad, el amor sacrificial y la santidad.',
    keyVerses: ['Génesis 2:24', 'Efesios 5:25-33', 'Hebreos 13:4', '1 Corintios 7:39', 'Proverbios 18:22'],
    coreTruths: [
      'El matrimonio es un pacto, no solo un contrato emocional.',
      'El amor conyugal es sacrificial y recíproco.',
      'La fidelidad sexual y emocional es parte de la santidad.',
    ],
    misconceptions: [
      'Creer que el matrimonio existe solo para la satisfacción personal.',
      'Creer que el amor justifica cualquier ruptura.',
      'Confundir roles bíblicos con abuso o dominación.',
    ],
    application: [
      'Cultiva la comunicación y la oración en pareja.',
      'Busca consejería antes de que los conflictos se cronifiquen.',
      'Renueva el pacto con hechos concretos, no solo con palabras.',
    ],
  },
  {
    id: 'liderazgo',
    title: 'El liderazgo cristiano',
    aliases: ['liderazgo', 'lider', 'pastor', 'anciano', 'servidor', 'autoridad'],
    summary:
      'El liderazgo cristiano es servicio, no dominación. Quien lidera debe modelar humildad, integridad, cuidado del rebaño y dependencia de Dios.',
    keyVerses: ['Marcos 10:42-45', '1 Pedro 5:2-3', '1 Timoteo 3:1-7', 'Tito 1:5-9', 'Juan 13:14-15'],
    coreTruths: [
      'La grandeza en el Reino se mide por el servicio.',
      'El líder debe ser ejemplo, no solo administrador.',
      'La autoridad espiritual se ejerce con rendición de cuentas.',
    ],
    misconceptions: [
      'Confundir liderazgo con poder, fama o control.',
      'Creer que el líder no necesita cuidado ni comunidad.',
      'Descuidar la familia mientras se sirve a la iglesia.',
    ],
    application: [
      'Delega y forma a otros líderes.',
      'Protege tu tiempo de oración, descanso y familia.',
      'Pide retroalimentación honesta a tu equipo.',
    ],
  },
];

export const CHARACTER_CATALOG: CharacterEntry[] = [
  {
    id: 'david',
    name: 'David',
    title: 'Pastor, rey y salmista',
    aliases: ['david', 'rey david'],
    keyVerses: ['1 Samuel 16:7', '1 Samuel 17:45-47', '2 Samuel 7:12-16', 'Salmos 51:1-12', 'Hechos 13:22'],
    summary:
      'David fue elegido por Dios, venció a Goliat, reinó sobre Israel y recibió la promesa de un trono eterno. Su vida muestra tanto la grandeza de la fe como la gravedad del pecado y la profundidad del arrepentimiento.',
    faithMoments: [
      'Confió en Dios frente a Goliat cuando todos temían.',
      'Respetó la vida de Saúl aunque tenía ocasión de vengarse.',
      'Cantó al Señor en medio de la persecución y del duelo.',
    ],
    failures: [
      'Cometió adulterio con Betsabé y ordenó la muerte de Urías.',
      'Permitió que su pasividad familiar sembrara tragedia en su casa.',
      'Contó el pueblo por orgullo y sufrió las consecuencias.',
    ],
    lessons: [
      'Dios mira el corazón, no la apariencia.',
      'El arrepentimiento verdadero no niega el pecado ni se queda en la culpa.',
      'Las consecuencias del pecado pueden permanecer aun después del perdón.',
    ],
    christConnection:
      'David es el antepasado del Mesías. Su trono se cumple eternamente en Jesucristo, el Hijo de David (Lucas 1:32-33).',
  },
  {
    id: 'moises',
    name: 'Moisés',
    title: 'Libertador, legislador y profeta',
    aliases: ['moises', 'moisés'],
    keyVerses: ['Éxodo 3:10-14', 'Éxodo 14:13-14', 'Éxodo 20:1-17', 'Deuteronomio 34:10', 'Hebreos 11:24-27'],
    summary:
      'Moisés fue llamado por Dios para liberar a Israel de Egipto, recibir la ley y guiar al pueblo por el desierto. Su vida muestra la santidad de Dios, la paciencia del líder y la necesidad de un mediador.',
    faithMoments: [
      'Aceptó el llamado después de reconocer su incapacidad.',
      'Confrontó a Faraón en nombre de Dios.',
      'Intercedió por el pueblo cuando merecía juicio.',
    ],
    failures: [
      'Mató a un egipcio y huyó al desierto.',
      'Dudó de Dios y golpeó la roca, perdiendo la entrada a la tierra prometida.',
      'Se sobrecargó de responsabilidades hasta que Jetro lo aconsejó.',
    ],
    lessons: [
      'Dios usa personas lentas de palabra y con pasado.',
      'El liderazgo requiere delegar y compartir la carga.',
      'La santidad de Dios no puede tomarse a la ligera.',
    ],
    christConnection:
      'Moisés anunció un profeta como él (Deuteronomio 18:15), cumplido en Jesús, el mediador del nuevo pacto.',
  },
  {
    id: 'abraham',
    name: 'Abraham',
    title: 'Padre de la fe',
    aliases: ['abraham', 'abrahan'],
    keyVerses: ['Génesis 12:1-3', 'Génesis 15:6', 'Génesis 22:1-18', 'Romanos 4:3', 'Hebreos 11:8-10'],
    summary:
      'Abraham fue llamado a dejar su tierra y confiar en la promesa de Dios. Su vida es el modelo de la justificación por la fe y de la obediencia que camina sin ver el final del camino.',
    faithMoments: [
      'Salió de su tierra sin saber a dónde iba.',
      'Creyó la promesa de una descendencia imposible.',
      'Estuvo dispuesto a entregar a Isaac, confiando en la provisión de Dios.',
    ],
    failures: [
      'Mintió sobre Sara en Egipto por miedo.',
      'Intentó cumplir la promesa por medio de Agar.',
      'Dudó del tiempo de Dios.',
    ],
    lessons: [
      'La fe se apoya en la promesa, no en la visibilidad inmediata.',
      'La impaciencia produce atajos que complican el camino.',
      'Dios provee el sacrificio que nosotros no podemos ofrecer.',
    ],
    christConnection:
      'En Cristo, la descendencia de Abraham bendice a todas las naciones (Gálatas 3:16).',
  },
  {
    id: 'jose',
    name: 'José',
    title: 'El soñador vendido y exaltado',
    aliases: ['jose', 'josé', 'hijo de jacob'],
    keyVerses: ['Génesis 37:5-11', 'Génesis 39:2-4', 'Génesis 41:38-41', 'Génesis 50:20'],
    summary:
      'José fue vendido por sus hermanos, acusado falsamente y encarcelado, pero Dios lo exaltó en Egipto para preservar la vida de muchos. Su historia es un espejo de la soberanía de Dios sobre la traición.',
    faithMoments: [
      'Mantuvo integridad ante la tentación sexual.',
      'Interpretó los sueños reconociendo que la interpretación es de Dios.',
      'Perdonó a sus hermanos y los sostuvo en la hambruna.',
    ],
    failures: [
      'Compartió sueños con inmadurez y provocó el resentimiento de sus hermanos.',
      'Su historia incluye años de sufrimiento que no eligió.',
    ],
    lessons: [
      'Dios puede redimir el mal que otros hicieron.',
      'La integridad se prueba lejos de casa y sin testigos.',
      'El perdón no niega el daño, pero lo pone en manos de Dios.',
    ],
    christConnection:
      'José prefigura a Cristo: rechazado por los suyos, sufrió y fue exaltado para salvar a muchos.',
  },
  {
    id: 'pedro',
    name: 'Pedro',
    title: 'Pescador, discípulo y apóstol restaurado',
    aliases: ['pedro', 'simon pedro', 'simón pedro', 'cefas'],
    keyVerses: ['Mateo 16:16-18', 'Juan 21:15-19', 'Hechos 2:14-41', '1 Pedro 5:6-7'],
    summary:
      'Pedro fue el discípulo impulsivo que confesó a Jesús como el Cristo, lo negó tres veces y fue restaurado por el Resucitado. Su vida muestra que el fracaso no es el final del llamado.',
    faithMoments: [
      'Caminó sobre el agua hacia Jesús.',
      'Confesó a Jesús como el Hijo del Dios viviente.',
      'Predicó con valentía en Pentecostés.',
    ],
    failures: [
      'Negó a Jesús tres veces.',
      'Reprendió a Jesús por anunciar la cruz.',
      'Actuó con parcialidad en Antioquía.',
    ],
    lessons: [
      'La restauración de Cristo es más grande que nuestra negación.',
      'El celo debe ser moldeado por la humildad.',
      'El líder maduro recuerda de dónde lo sacó la gracia.',
    ],
    christConnection:
      'Jesús restauró a Pedro junto al fuego y le encomendó cuidar sus ovejas (Juan 21).',
  },
  {
    id: 'pablo',
    name: 'Pablo',
    title: 'Apóstol de los gentiles',
    aliases: ['pablo', 'saulo', 'saulo de tarso'],
    keyVerses: ['Hechos 9:1-19', 'Gálatas 1:13-16', 'Filipenses 3:4-11', '2 Timoteo 4:6-8'],
    summary:
      'Pablo persiguió a la iglesia hasta que Cristo lo confrontó en el camino a Damasco. Transformado por la gracia, se convirtió en el gran misionero y teólogo del evangelio a los gentiles.',
    faithMoments: [
      'Predicó a Cristo después de haberlo perseguido.',
      'Sufrió cárceles y naufragios por el evangelio.',
      'Escribió cartas que siguen formando a la iglesia.',
    ],
    failures: [
      'Participó en la persecución y muerte de cristianos.',
      'Tuvo conflictos fuertes, como el desacuerdo con Bernabé.',
      'Reconoció una lucha constante con la carne (Romanos 7).',
    ],
    lessons: [
      'Nadie está fuera del alcance de la gracia.',
      'El pasado no define el llamado de Dios.',
      'La teología verdadera se vive en sufrimiento y servicio.',
    ],
    christConnection:
      'Pablo proclamó a Cristo crucificado como poder y sabiduría de Dios (1 Corintios 1:23-24).',
  },
  {
    id: 'elias',
    name: 'Elías',
    title: 'Profeta del fuego y del silbo apacible',
    aliases: ['elias', 'elías'],
    keyVerses: ['1 Reyes 18:20-39', '1 Reyes 19:1-18', 'Santiago 5:17-18'],
    summary:
      'Elías confrontó la idolatría de Israel en el Carmelo y luego huyó al desierto, agotado y deseando morir. Dios lo sostuvo con pan, descanso y una voz apacible.',
    faithMoments: [
      'Ora y desciende fuego del cielo en el Carmelo.',
      'Confió en la provisión de Dios junto al arroyo.',
      'Escuchó la voz de Dios en la quietud.',
    ],
    failures: [
      'Huyó con miedo después de la gran victoria.',
      'Se aisló y pidió morir en el desierto.',
      'Creyó que era el único fiel que quedaba.',
    ],
    lessons: [
      'El agotamiento puede llegar incluso después de un éxito espiritual.',
      'Dios cuida el cuerpo y las emociones antes de dar nuevas órdenes.',
      'No estamos solos aunque nos sintamos así.',
    ],
    christConnection:
      'Elías aparece con Moisés en la transfiguración, señalando a Jesús como el profeta esperado (Mateo 17:1-8).',
  },
  {
    id: 'job',
    name: 'Job',
    title: 'El sufriente que vio a Dios',
    aliases: ['job', 'sufrimiento de job'],
    keyVerses: ['Job 1:20-21', 'Job 2:10', 'Job 19:25-27', 'Job 42:1-6'],
    summary:
      'Job perdió bienes, hijos y salud en un ataque espiritual. Su historia no ofrece una explicación fácil del dolor, pero muestra la fe que clama, discute con Dios y termina viéndolo.',
    faithMoments: [
      'Bendijo a Dios en medio de la pérdida.',
      'Se aferró a la esperanza de un Redentor vivo.',
      'Reconoció su ignorancia ante la majestad de Dios.',
    ],
    failures: [
      'Sus amigos ofrecieron explicaciones simplistas y culpabilizadoras.',
      'Job llegó al límite de sus fuerzas y maldijo el día de su nacimiento.',
    ],
    lessons: [
      'El sufrimiento no siempre se explica por un pecado específico.',
      'Es legítimo lamentar y preguntar a Dios.',
      'La presencia de Dios vale más que una respuesta teórica.',
    ],
    christConnection:
      'Job anticipa al Justo que sufre por otros y confía en un Redentor viviente (Job 19:25).',
  },
  {
    id: 'ester',
    name: 'Ester',
    title: 'Reina valiente en Persia',
    aliases: ['ester', 'hadassah'],
    keyVerses: ['Ester 2:17', 'Ester 4:14-16', 'Ester 7:3-6', 'Ester 9:20-22'],
    summary:
      'Ester, una joven judía en Persia, llegó a ser reina y arriesgó su vida para salvar a su pueblo de un decreto de exterminio. Su historia muestra la providencia oculta de Dios y el valor de la intercesión.',
    faithMoments: [
      'Ayunó y buscó el favor de Dios antes de presentarse ante el rey.',
      'Denunció el plan de Amán con valentía.',
      'Estableció una memoria anual de liberación.',
    ],
    failures: [
      'Al principio ocultó su identidad por prudencia y miedo.',
      'La historia no menciona directamente el nombre de Dios: exige leer la providencia con ojos de fe.',
    ],
    lessons: [
      'Dios puede usar posiciones de privilegio para proteger a los vulnerables.',
      'El valor no es ausencia de miedo, sino obediencia a pesar del miedo.',
      'La comunidad que ayuna y ora sostiene a sus líderes.',
    ],
    christConnection:
      'Ester es un eco de Cristo: intercede por un pueblo condenado y pone su vida en la balanza.',
  },
  {
    id: 'rut',
    name: 'Rut',
    title: 'Moabita redimida y antepasada de David',
    aliases: ['rut', 'ruth'],
    keyVerses: ['Rut 1:16-17', 'Rut 2:11-12', 'Rut 4:13-17', 'Mateo 1:5'],
    summary:
      'Rut, una viuda moabita, se unió a Noemí y al Dios de Israel por lealtad y fe. Su historia muestra la redención que incluye a los extranjeros y la providencia en lo cotidiano.',
    faithMoments: [
      'Confesó al Dios de Israel como su Dios.',
      'Trabajó con humildad para sostener a Noemí.',
      'Confió en el consejo de su suegra.',
    ],
    failures: [
      'Vivió la pérdida de su esposo y la pobreza.',
      'Su condición de extranjera la exponía a vulnerabilidad.',
    ],
    lessons: [
      'La fidelidad se demuestra en lo pequeño y cotidiano.',
      'Dios incluye a los de fuera en su historia de salvación.',
      'La redención requiere un redentor dispuesto.',
    ],
    christConnection:
      'Rut entra en la genealogía de Jesús (Mateo 1:5), mostrando que la gracia cruza fronteras.',
  },
  {
    id: 'daniel',
    name: 'Daniel',
    title: 'Fiel en Babilonia',
    aliases: ['daniel'],
    keyVerses: ['Daniel 1:8', 'Daniel 3:16-18', 'Daniel 6:10', 'Daniel 9:3-19'],
    summary:
      'Daniel fue llevado cautivo a Babilonia y sirvió con excelencia sin comprometer su fe. Su vida muestra la fidelidad en el exilio, la oración constante y la soberanía de Dios sobre los imperios.',
    faithMoments: [
      'Se propuso no contaminarse con la comida del rey.',
      'Oró tres veces al día a pesar del decreto.',
      'Interpretó sueños y recibió visiones apocalípticas.',
    ],
    failures: [
      'No se registran fallas morales graves, pero su vida estuvo marcada por la presión y el exilio.',
    ],
    lessons: [
      'La excelencia profesional puede ser un acto de adoración.',
      'La fidelidad se decide antes de la crisis.',
      'Dios gobierna sobre los imperios.',
    ],
    christConnection:
      'Daniel ve al Hijo del Hombre que recibe un reino eterno (Daniel 7:13-14), cumplido en Cristo.',
  },
  {
    id: 'jonas',
    name: 'Jonás',
    title: 'Profeta que huyó y aprendió misericordia',
    aliases: ['jonas', 'jonás'],
    keyVerses: ['Jonás 1:1-3', 'Jonás 2:1-10', 'Jonás 3:1-10', 'Jonás 4:1-11'],
    summary:
      'Jonás huyó del llamado de Dios, fue tragado por un gran pez y luego predicó a Nínive. Su historia muestra la misericordia de Dios hacia los pecadores y la resistencia del profeta a esa misericordia.',
    faithMoments: [
      'Oró desde el vientre del pez y reconoció la salvación de Dios.',
      'Predicó a Nínive y el pueblo se arrepintió.',
    ],
    failures: [
      'Huyó de Dios.',
      'Se enojó porque Dios perdonó a Nínive.',
      'Se preocupó más por una planta que por personas.',
    ],
    lessons: [
      'No se puede huir del llamado de Dios.',
      'La misericordia de Dios es más amplia que nuestros prejuicios.',
      'El corazón del profeta también necesita arrepentimiento.',
    ],
    christConnection:
      'Jesús señala a Jonás como señal de su muerte y resurrección (Mateo 12:39-41).',
  },
  {
    id: 'maria',
    name: 'María',
    title: 'Madre de Jesús y sierva del Señor',
    aliases: ['maria', 'maría', 'virgen maria'],
    keyVerses: ['Lucas 1:38', 'Lucas 1:46-55', 'Juan 2:5', 'Juan 19:25-27', 'Hechos 1:14'],
    summary:
      'María recibió el anuncio del ángel con fe y se entregó como sierva del Señor. Su vida muestra la humildad, la obediencia y el dolor de acompañar a Cristo hasta la cruz.',
    faithMoments: [
      'Aceptó el llamado aunque implicaba vergüenza y riesgo.',
      'Alabó a Dios con el Magníficat.',
      'Perseveró junto a la cruz y en la oración de la iglesia.',
    ],
    failures: [
      'No se registran fallas morales; la tradición la muestra como creyente necesitada de gracia.',
    ],
    lessons: [
      'La obediencia puede costar, pero Dios sostiene.',
      'La grandeza delante de Dios se expresa en servicio.',
      'La fe madura también en el dolor.',
    ],
    christConnection:
      'María concibió al Hijo de Dios y lo acompañó hasta la cruz, donde fue confiada al discípulo amado.',
  },
  {
    id: 'josue',
    name: 'Josué',
    title: 'Sucesor de Moisés y conquistador',
    aliases: ['josue', 'josué'],
    keyVerses: ['Josué 1:1-9', 'Josué 6:1-27', 'Josué 24:14-15'],
    summary:
      'Josué fue llamado a suceder a Moisés y guiar a Israel a la tierra prometida. Su vida muestra el valor que nace de la presencia de Dios y la fidelidad a su Palabra.',
    faithMoments: [
      'Confió en Dios para cruzar el Jordán.',
      'Siguió el plan de Dios para Jericó.',
      'Renovó el pacto y desafió al pueblo a elegir a quién servir.',
    ],
    failures: [
      'Fue engañado por los gabaonitas.',
      'No consultó a Dios en esa decisión.',
    ],
    lessons: [
      'El valor se apoya en la presencia y la Palabra de Dios.',
      'El liderazgo requiere consultar a Dios, no solo estrategia.',
      'La fidelidad se renueva con decisiones concretas.',
    ],
    christConnection:
      'Josué comparte nombre con Jesús (Yehoshúa) y prefigura al que introduce al pueblo en el reposo definitivo (Hebreos 4:8-10).',
  },
  {
    id: 'tomas',
    name: 'Tomás',
    title: 'Discípulo que pasó de la duda a la confesión',
    aliases: ['tomas', 'tomás', 'dídimo'],
    keyVerses: ['Juan 11:16', 'Juan 14:5', 'Juan 20:24-29'],
    summary:
      'Tomás es recordado por dudar de la resurrección, pero también por su valentía y su confesión final: «¡Señor mío, y Dios mío!». Su historia muestra que la duda honesta puede llevarnos a una fe más profunda.',
    faithMoments: [
      'Estuvo dispuesto a morir con Jesús.',
      'Preguntó con honestidad sobre el camino.',
      'Confesó la deidad de Cristo al verlo resucitado.',
    ],
    failures: [
      'Se negó a creer sin pruebas físicas.',
      'Se aisló de los otros discípulos en un momento clave.',
    ],
    lessons: [
      'Dios no desprecia la duda sincera.',
      'La fe se fortalece en comunidad.',
      'La confesión de Cristo es el centro de la vida cristiana.',
    ],
    christConnection:
      'Tomás reconoce a Jesús resucitado como Señor y Dios (Juan 20:28).',
  },
];

function normalizeQuery(text: string): string {
  return normalize(text);
}

export function matchDoctrineEntry(query: string): DoctrineEntry | null {
  const text = normalizeQuery(query);
  let best: { entry: DoctrineEntry; score: number } | null = null;

  for (const entry of DOCTRINE_CATALOG) {
    let score = 0;
    for (const alias of entry.aliases) {
      const normalizedAlias = normalize(alias);
      const matched = normalizedAlias.includes(' ')
        ? text.includes(normalizedAlias)
        : new RegExp(`\\b${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
      if (matched) {
        score += normalizedAlias.includes(' ') ? 3 : 2;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  return best?.entry ?? null;
}

export function matchCharacterEntry(query: string): CharacterEntry | null {
  const text = normalizeQuery(query);
  let best: { entry: CharacterEntry; score: number } | null = null;

  for (const entry of CHARACTER_CATALOG) {
    let score = 0;
    for (const alias of entry.aliases) {
      const normalizedAlias = normalize(alias);
      if (new RegExp(`\\b${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
        score += alias.split(/\s+/).length > 1 ? 3 : 2;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  return best?.entry ?? null;
}

export function doctrineTitles(): string[] {
  return DOCTRINE_CATALOG.map((entry) => entry.title);
}

export function characterNames(): string[] {
  return CHARACTER_CATALOG.map((entry) => entry.name);
}
