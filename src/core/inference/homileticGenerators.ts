import { CanonicalBookProfile, findCanonicalBook } from '../database/canonicalBooks.js';
import { findBiblicalMirror } from '../rag/casuistryMapper.js';

interface HomileticContext {
  prompt: string;
  book?: CanonicalBookProfile | null;
  topic: string;
  firstCitation: string;
  secondCitation: string;
  thirdCitation: string;
  fourthCitation: string;
}

function resolveContext(prompt: string, availableCitations: string[]): HomileticContext {
  const book = findCanonicalBook(prompt);
  const mirror = findBiblicalMirror(prompt);
  const lower = prompt.toLowerCase();

  let topic = prompt
    .replace(/(?:quiero|necesito|un|una|estudio|bosquejo|sermon|sermón|predica|prédica|para|dar|el|un|culto|clase|sobre|de|en|los|las)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!topic || topic.length < 3) {
    if (book) topic = book.nombre;
    else if (mirror) topic = mirror.titulo;
    else topic = 'la Fidelidad y la Gracia de Dios';
  }

  // Capitalizar tema
  topic = topic.charAt(0).toUpperCase() + topic.slice(1);

  // Determinar 4 citas bíblicas sólidas
  let c1 = availableCitations[0];
  let c2 = availableCitations[1];
  let c3 = availableCitations[2];
  let c4 = availableCitations[3];

  if (book) {
    const refs = book.versiculosClaveRefs;
    if (!c1) c1 = `${book.nombre} ${refs[0] || '1:1'}`;
    if (!c2) c2 = `${book.nombre} ${refs[1] || refs[0] || '1:16'}`;
    if (!c3) c3 = `${book.nombre} ${refs[2] || refs[1] || '8:28'}`;
    if (!c4) c4 = `${book.nombre} ${refs[3] || refs[2] || '12:1'}`;
  } else if (mirror) {
    const vc = mirror.versiculosClave;
    if (!c1) c1 = vc[0] || 'Salmos 23:1';
    if (!c2) c2 = vc[1] || 'Filipenses 4:13';
    if (!c3) c3 = 'Jeremías 29:11';
    if (!c4) c4 = 'Romanos 8:28';
  } else {
    if (!c1) c1 = lower.includes('pastor') ? 'Salmos 23:1' : 'Juan 3:16';
    if (!c2) c2 = 'Romanos 8:28';
    if (!c3) c3 = 'Filipenses 4:6-7';
    if (!c4) c4 = 'Josué 1:9';
  }

  return { prompt, book, topic, firstCitation: c1, secondCitation: c2, thirdCitation: c3, fourthCitation: c4 };
}

/**
 * 1. SERMON_CULTO: Mensaje de Púlpito para 45-60 min (> 2,500 caracteres)
 */
export function composeSermonCulto(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const bookName = ctx.book ? ctx.book.nombre : ctx.topic;
  const authorInfo = ctx.book ? `${ctx.book.autor} (${ctx.book.contextoHistorico})` : 'Inspiración Profética y Apostólica Canónica';

  return (
    `# SERMÓN HOMILÉTICO DE PÚLPITO: ${bookName.toUpperCase()}\n` +
    `## «El Poder Transformador de la Gracia Soberana: De la Condenación a la Gloria Eterna»\n\n` +
    `**Texto Áureo de Apertura:** [CITA: ${ctx.firstCitation}]\n` +
    `**Marco Histórico y Autor:** ${authorInfo}\n` +
    `**Tiempo Estimado de Exposición:** 45 a 55 minutos\n\n` +
    `---\n\n` +
    `### I. PROPÓSITO MINISTERIAL Y VERDAD CENTRAL\n` +
    `* **Verdad Central:** La iniciativa de Dios en su pacto no depende de la fuerza humana ni de las obras meritorias, sino de su misericordia inmutable revelada plenamente en Jesucristo, la cual rescata al pecador, sana el corazón quebrantado y lo capacita para una vida de santidad contagiosa.\n` +
    `* **Propósito Homilético:** Que cada miembro de la congregación desmonte la máscara de la autosuficiencia o la carga de la condenación interior, rinda sus batallas en el altar y salga convencido de que su identidad está sellada por el amor del Padre celestial.\n\n` +
    `### II. INTRODUCCIÓN PASTORAL Y ROMPEHIELO CONGREGACIONAL\n` +
    `Amados hermanos, si hay algo que desgasta el alma del ser humano en este siglo agitado es la constante presión de tener que demostrar quiénes somos. Vivimos en una sociedad de contratos y evaluaciones: te miden por lo que rindes, te aceptan por lo que aportas y te descartan cuando fallas. Esa mentalidad de esclavos muchas veces la trasladamos en silencio a nuestra relación con Dios. Venimos a la casa de oración sintiéndonos en deuda, arrastrando culpas no resueltas o creyendo que una mala semana nos despojó de la sonrisa del Señor.\n\n` +
    `Imaginen por un momento a un deudor llevado a la corte suprema, con una suma tan exorbitante que ni trabajando diez vidas enteras podría liquidarla. Las manos le tiemblan, el juez alza el mazo, pero de pronto entra el propio Hijo del Rey, pone su nombre en el documento, rompe la orden de embargo con su propia sangre y le dice: *«Tu deuda ha sido consumada; ahora camina como hijo libre de este palacio»*. Eso es exactamente lo que las Escrituras proclaman en ${bookName}.\n\n` +
    `Pregunta para confrontar el corazón de la iglesia: *¿Cuánto tiempo más vas a seguir intentando pagar un precio que Cristo ya canceló en el Calvario?* Acompáñenme a examinar cuatro verdades inamovibles que transformarán nuestra fe hoy.\n\n` +
    `### III. CUATRO MOVIMIENTOS EXPOSITIVOS DE LA PALABRA\n\n` +
    `#### 1. El Diagnóstico del Corazón y el Fracaso de la Autosuficiencia\n` +
    `La revelación bíblica comienza quitándonos los espejismos. Antes de apreciar la medicina del Evangelio, necesitamos aceptar la gravedad del diagnóstico. La condición humana sin Dios está en bancarrota espiritual total; nuestras mejores justicias son como trapos de inmundicia ante la majestad del tres veces Santo.\n` +
    `* **Lectura Base:** [CITA: ${ctx.firstCitation}]\n` +
    `* **Evidencia Cruzada (TSK):** Conectado con la verdad de que todos estamos destituidos de la gloria divina sin Cristo.\n` +
    `* **Léxico Sagrado:** La raíz en Griego Koiné para gracia es **[G5485: cháris]**, que designa el favor inmerecido y generoso que desciende del soberano hacia el indigno, sin que medie ningún derecho contractual.\n` +
    `* **Ilustración de Altar:** El hijo pródigo comiendo algarrobas en el fango no regresó a casa negociando un sueldo de jornalero; fue restaurado por un abrazo que le colocó el anillo de hijo antes de que pudiera balbucear su excusa.\n` +
    `* **Frase de Poder (Repetir con la iglesia):** *«La gracia de Dios no busca personas perfectas; busca personas quebrantadas para vestirlas de su perfecta justicia»*.\n\n` +
    `#### 2. Paz Inquebrantable y Justificación Definitiva en el Pacto\n` +
    `Cuando Dios justifica al creyente mediante la fe, no realiza un mero trámite administrativo superficial: firma un decreto judicial eterno en los cielos. La justificación significa que somos declarados inocentes y aceptados para siempre gracias a los méritos del Cordero.\n` +
    `* **Lectura Base:** [CITA: ${ctx.secondCitation}]\n` +
    `* **Léxico Sagrado:** La paz que Dios nos entrega es **[G1515: eirḗnē]**, que en la mentalidad bíblica no es simple ausencia de conflicto exterior, sino descanso pleno, salud espiritual y total reconciliación con el Creador.\n` +
    `* **Ilustración de Altar:** En medio de la tempestad en alta mar, el ancla no se arroja dentro del barco para afirmarse en la madera que se sacude, sino que se hunde en la roca invisible del fondo marino. Nuestra paz no está anclada en nuestras emociones, sino en el trono inmutable de Dios.\n` +
    `* **Frase de Poder:** *«Si Cristo pagó tu rescate en la cruz, el diablo no tiene autoridad para cobrarte deudas pasadas»*.\n\n` +
    `#### 3. Seguridad Eterna y el Vínculo Indestructible de su Amor\n` +
    `Muchos creyentes viven con miedo a perder el favor de Dios al primer tropiezo. Sin embargo, el apóstol nos asegura que ninguna criatura, ni principados, ni lo presente ni lo por venir tiene la fuerza de arrancarnos de la diestra soberana de Cristo.\n` +
    `* **Lectura Base:** [CITA: ${ctx.thirdCitation}]\n` +
    `* **Léxico Sagrado:** El amor de Dios no es mero afecto humano condicional; es **[G26: agápē]**, el amor abnegado, sacrificial y pactual que jamás se rinde ni se extingue.\n` +
    `* **Ilustración de Altar:** Una madre que cuida a un niño que aprende a dar sus primeros pasos: cuando el niño se tambalea y cae, la madre no lo abandona ni lo desconoce como hijo; se apresura a levantarlo, le limpia las rodillas y le infunde aliento para continuar.\n` +
    `* **Frase de Poder:** *«No nos sostenemos de Dios por la fuerza de nuestras manos; nos sostiene la fidelidad invencible de las suyas»*.\n\n` +
    `#### 4. El Culto Racional: Una Vida Rendida en Adoración Práctica\n` +
    `La gracia divina nunca produce pasividad ni libertinaje, sino una pasión ardiente por vivir en obediencia agradecida. No servimos a Dios para que nos ame; le servimos porque ya nos amó primero de una manera sobreabundante.\n` +
    `* **Lectura Base:** [CITA: ${ctx.fourthCitation}]\n` +
    `* **Desafío Homilético:** Nuestro culto a Dios no termina al apagar las luces del templo o salir por la puerta; comienza en la oficina, en la mesa del hogar, en la fidelidad económica y en el perdón hacia quienes nos lastimaron.\n` +
    `* **Frase de Poder:** *«No te conformes con asistir al templo; conviértete en un altar vivo donde el fuego del Espíritu nunca se apague»*.\n\n` +
    `### IV. CONCLUSIÓN Y LLAMADO MINISTERIAL AL ALTAR\n` +
    `* **Resumen de Decisiones:**\n` +
    `  1. Renuncia a la carga de la condenación y recibe el perdón absoluto de tus faltas.\n` +
    `  2. Descansa en la soberanía de Dios: tus crisis actuales no son el fin de tu historia, sino el taller de su gloria.\n` +
    `  3. Rinde tu mente, tus talentos y tu familia como sacrificio vivo y agradable al Señor.\n\n` +
    `* **Oración Pastoral para Ministrar desde el Púlpito:**\n` +
    `  *«Padre celestial, Dios de toda gracia y consolación: venimos ante tu presencia con el corazón rendido. Reconocemos que no tenemos nada de qué gloriarnos sino en la bendita cruz de tu Hijo Jesucristo. Rompe hoy en este altar toda cadena de culpabilidad, todo yugo de temor y toda atadura que el enemigo haya querido sembrar sobre tus hijos. Te pedimos que selles con fuego de tu Espíritu la verdad de ${bookName} en cada vida. Que el quebrantado se levante sano, que el desanimado sea revestido de fuerza y que esta congregación camine como testimonio viviente de tu reino. En el nombre glorioso de Jesús oramos, ¡amén y amén!»*\n\n` +
    `* **Desafío Semanal Congregacional:** Esta semana, antes de quejarte o dudar ante cualquier dificultad, detén tus pensamientos por 30 segundos y proclama en voz alta: *«El Señor es mi amparo; su gracia me basta»*. Bendice además con una palabra de gracia a una persona que consideres difícil en tu entorno.\n\n` +
    `💡 *Material Homilético Completo. Puedes fijar este sermón a tu Pizarra de Estudio, enriquecerlo y exportarlo en formato limpio para WhatsApp o PDF editorial.*`
  );
}

/**
 * 2. ESTUDIO_CLASE: Escuela Dominical / Instituto Bíblico (> 2,500 caracteres)
 */
export function composeEstudioClase(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const bookName = ctx.book ? ctx.book.nombre : ctx.topic;

  return (
    `# GUÍA PEDAGÓGICA Y LECCIÓN EXEGÉTICA: ${bookName.toUpperCase()}\n` +
    `## Módulo Docente para Escuela Dominical e Instituto Bíblico\n\n` +
    `**Nivel de Instrucción:** Discípulo / Maestro Bíblico\n` +
    `**Pasajes Principales de Estudio:** [CITA: ${ctx.firstCitation}] y [CITA: ${ctx.secondCitation}]\n\n` +
    `---\n\n` +
    `### 1. OBJETIVOS PEDAGÓGICOS INTEGRALES (TAXONOMÍA DE APRENDIZAJE)\n` +
    `* **Objetivo Cognitivo (Saber):** Identificar con rigor el trasfondo histórico, el propósito teológico original y la estructura literaria de ${bookName}, reconociendo los términos clave en su lengua original.\n` +
    `* **Objetivo Afectivo (Sentir):** Desarrollar en el estudiante una reverente devoción ante la soberanía divina, experimentando la convicción de que las promesas bíblicas son infalibles.\n` +
    `* **Objetivo Conductual (Hacer):** Diseñar un plan de acción semanal para aplicar los principios exegéticos estudiados en la toma de decisiones éticas, familiares y comunitarias.\n\n` +
    `### 2. PANORAMA CANÓNICO Y TRASFONDO HISTÓRICO-CULTURAL\n` +
    `El estudio de ${bookName} no puede realizarse de espaldas al contexto de su redacción. Las Escrituras fueron inspiradas en situaciones históricas concretas que arrojan luz sobre el texto:\n` +
    `* **Autoría y Fecha:** Escrito en un contexto de consolidación pactual y desafíos teológicos cruciales frente a la cultura circundante.\n` +
    `* **Situación de la Comunidad Original:** Los destinatarios enfrentaban presiones de persecución, asimilación cultural y la tentación del compromiso moral con los sistemas idolátricos de su tiempo.\n` +
    `* **Tema Teológico Unificador:** La auto-revelación de Dios como Señor fiel del pacto que demanda lealtad indivisible y provee redención para su pueblo.\n\n` +
    `### 3. ANÁLISIS EXEGÉTICO Y LECTURA DEL TEXTO\n` +
    `#### Sección A: El Fundamento de la Revelación y la Demanda Divina\n` +
    `Al examinar el pasaje [CITA: ${ctx.firstCitation}], notamos la estructura quiástica y el peso de las cláusulas verbales. El texto establece de forma indiscutible que Dios toma la iniciativa.\n` +
    `* **Observación Literaria:** Nótese la insistencia en los atributos inmutables del Señor frente a la fragilidad de los ídolos o de las obras humanas.\n` +
    `* **Interpretación Hermenéutica:** No podemos edificar doctrina bíblica sobre interpretaciones alegóricas aisladas; el sentido literal e histórico-gramatical debe gobernar la enseñanza.\n\n` +
    `#### Sección B: La Articulación con el Nuevo Pacto\n` +
    `El testimonio canónico se complementa armónicamente con [CITA: ${ctx.secondCitation}]. La ley, los profetas y los apóstoles apuntan de manera convergente a la consumación en Cristo.\n` +
    `* **Conexión Intertextual (TSK):** La armonía entre las dispensaciones demuestra que el plan de salvación nunca fue un plan alternativo de emergencia, sino el designio eterno de Dios.\n` +
    `* **Aplicación Docente:** Enfatizar a los alumnos que el Antiguo Testamento contiene al Nuevo en sombra, y el Nuevo explica al Antiguo en luz plena.\n\n` +
    `### 4. GLOSARIO DE TÉRMINOS CLAVE Y CÓDIGOS STRONG\n` +
    `* **[G5485: cháris] / [H2617: chésed]:** Gracia pactual, amor leal y bondad incondicional que no depende del mérito del beneficiario.\n` +
    `* **[G4102: pístis] / [H530: emunáh]:** Fe no como emoción ciega, sino como firmeza inconmovible, lealtad y convicción absoluta en la palabra prometida.\n` +
    `* **[G1343: dikaiosýnē]:** Justicia divina; la rectitud legal imputada que permite al hombre reconciliarse plenamente con su Hacedor.\n` +
    `* **[H7965: shalóm] / [G1515: eirḗnē]:** Integridad, reposo pleno, armonía restaurada y reconciliación total del ser.\n\n` +
    `### 5. CUADRO COMPARATIVO DOCTRINAL PARA LA PIZARRA\n\n` +
    `| Perspectiva Humana / Tradición | Revelación Bíblica Canónica (${bookName}) |\n` +
    `| :--- | :--- |\n` +
    `| Justificación por méritos propios y obras religiosas | Justificación exclusiva por la gracia mediante la fe ([CITA: ${ctx.firstCitation}]) |\n` +
    `| Relación condicional basada en el estado anímico | Pacto inquebrantable sellado por el amor de Dios ([CITA: ${ctx.secondCitation}]) |\n` +
    `| La santidad como carga legalista opresiva | La santidad como fruto alegre del Espíritu Santo en el corazón |\n` +
    `| Desesperanza ante el sufrimiento y la prueba | Certeza de que todas las cosas cooperan para bien de los llamados |\n\n` +
    `### 6. GUÍA DE DISCUSIÓN GRUPAL (5 PREGUNTAS PARA EL MAESTRO)\n` +
    `1. *¿Cuál es la diferencia radical entre el concepto bíblico de [G5485: cháris] y la idea secular de "tolerancia" o "favor comercial"?*\n` +
    `   * **Guía para el maestro:** La gracia no pasa por alto el pecado, sino que satisface la justicia en la expiación de Cristo; es un regalo soberano inmerecido.\n` +
    `2. *¿Cómo confronta el mensaje de ${bookName} la tendencia moderna a relativizar las verdades bíblicas absolutas?*\n` +
    `   * **Guía para el maestro:** Mostrar que la Palabra de Dios es la única norma inmutable de fe y conducta sobre cualquier opinión cultural.\n` +
    `3. *Al leer [CITA: ${ctx.firstCitation}], ¿qué evidencias encontramos de la fidelidad de Dios en momentos de prueba histórica?*\n` +
    `   * **Guía para el maestro:** Guiar a la clase a recordar pasajes donde Dios sustentó a su pueblo en el desierto o en el exilio.\n` +
    `4. *¿De qué manera la seguridad de nuestra salvación nos impulsa al servicio y no a la pasividad espiritual?*\n` +
    `   * **Guía para el maestro:** La gratitud por la gracia produce obediencia fervorosa y frutos dignos de arrepentimiento.\n` +
    `5. *¿Qué pasos prácticos puede tomar un discípulo cuando siente que sus oraciones no son respondidas con rapidez?*\n` +
    `   * **Guía para el maestro:** Afirmar la fe en la sabiduría del Padre y perseverar en la intercesión sin desmayar.\n\n` +
    `### 7. PLAN DE LECTURA Y TAREA SEMANAL (7 DÍAS)\n` +
    `* **Día 1:** Lectura reposada de [CITA: ${ctx.firstCitation}], anotando en un diario los verbos que describen las acciones de Dios.\n` +
    `* **Día 2:** Meditación en el contexto histórico del libro y oración de agradecimiento por su preservación providencial.\n` +
    `* **Día 3:** Estudio del término Strong asignado y búsqueda de dos referencias cruzadas en el texto bíblico.\n` +
    `* **Día 4:** Lectura de [CITA: ${ctx.secondCitation}], evaluando qué áreas de nuestro carácter necesitan alinearse con este mandato.\n` +
    `* **Día 5:** Ejercicio de memorización del versículo lema de la lección para proclamarlo en momentos de tentación.\n` +
    `* **Día 6:** Compartir con un hermano menor en la fe o familiar una de las verdades aprendidas en esta guía.\n` +
    `* **Día 7:** Evaluación personal ante el Señor y preparación del corazón para el culto congregacional del domingo.\n\n` +
    `💡 *Esta clase está lista para fotocopiar, exportar o proyectar en tu aula ministerial. Pulsa "Fijar" para guardarla en tu Pizarra.*`
  );
}

/**
 * 3. CELULA_JOVENES: Grupo Pequeño / Jóvenes (> 2,500 caracteres)
 */
export function composeCelulaJovenes(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const theme = ctx.topic;

  return (
    `# GUÍA PARA GRUPOS PEQUEÑOS Y CÉLULAS DE JÓVENES\n` +
    `## «Auténticos en la Presión: Firmeza, Identidad y Amistad Radical»\n\n` +
    `**Tema de la Noche:** ${theme}\n` +
    `**Pasaje Clave:** [CITA: ${ctx.firstCitation}]\n` +
    `**Duración Total del Encuentro:** 60 minutos dinámicos\n\n` +
    `---\n\n` +
    `### 1. CRONOGRAMA MINUTO A MINUTO (60 MIN)\n` +
    `* **00:00 - 00:10 (10 min):** Bienvenida, música suave de fondo, merienda ligera y bienvenida a amigos nuevos.\n` +
    `* **00:10 - 00:25 (15 min):** Dinámica Rompehielo «El Puente Imposible» (genera risas y abre la confianza).\n` +
    `* **00:25 - 00:45 (20 min):** Micro-charla participativa de la Palabra basada en [CITA: ${ctx.firstCitation}].\n` +
    `* **00:45 - 00:55 (10 min):** Preguntas de conversación sincera en grupos de 3 o 4 personas.\n` +
    `* **00:55 - 01:00 (5 min):** Ministración por parejas, oración por necesidades urgentes y reto semanal.\n\n` +
    `### 2. DINÁMICA ROMPEHIELO: «EL PUENTE DE LOS ACUERDOS»\n` +
    `* **Materiales Necesarios:** 1 pliego de papel periódico y una cinta adhesiva por cada equipo de 4 personas.\n` +
    `* **Instrucciones:** Cada equipo tiene 5 minutos para construir la torre o puente más alto posible que se sostenga solo sin tocar ninguna pared.\n` +
    `* **Moraleja y Conexión con el Tema:** Al final del juego, el líder nota: *«¿Vieron lo fácil que se cae una estructura si no tiene una base sólida o si cada uno jala para su lado? En la vida real, si construyes tu identidad sobre la opinión de los demás o las redes sociales, al menor viento te vienes abajo. Pero Dios nos ofrece un fundamento que nadie puede derribar»*.\n\n` +
    `### 3. HISTORIA ESPEJO: LA PRESIÓN DE ENCAJAR Y LA SOLEDAD REAL\n` +
    `Lucas tiene 19 años. En la universidad y en Instagram todo el mundo parece exitoso, seguro de sí mismo y rodeado de planes emocionantes. Pero cuando apaga la pantalla a las once de la noche, siente un vacío inmenso y una ansiedad constante por temor a no ser aceptado o quedar fuera del grupo. Para encajar, muchas veces cede en conversaciones que no le gustan o finge ser alguien que no es.\n\n` +
    `Muchos jóvenes en nuestras iglesias batallan con esa misma fatiga secreta: el cansancio de sostener un personaje. Pero cuando abrimos las Escrituras en [CITA: ${ctx.firstCitation}], descubrimos que Dios no nos llama a amoldarnos al mundo ni a buscar la validación de likes pasajeros. Su verdad nos dice:\n` +
    `* **Texto Fundamental:** [CITA: ${ctx.firstCitation}]\n` +
    `* **Promesa Complementaria:** [CITA: ${ctx.secondCitation}]\n\n` +
    `### 4. ENSEÑANZA CENTRAL INTERACTIVA (3 PUNTOS AL GRANO)\n` +
    `1. **Tu Valor no está en Subasta:** No vales por cuánta gente te aplaude, sino por la sangre que se pagó por ti en el madero. Cuando sabes de Quién eres, dejas de mendigar aceptación donde sea.\n` +
    `2. **Luz en Medio de la Corriente:** Nadar a favor de la corriente lo hace cualquier pez muerto; los peces vivos nadan río arriba. Dios te llamó a marcar la diferencia en tu salón de clases y en tu trabajo.\n` +
    `3. **Amistades que te Acerquen a la Meta:** Si tus amigos más cercanos te apagan el fuego espiritual o se burlan de tu fe, es tiempo de replantear tus prioridades. En la célula encontramos hermanos que oran por nosotros cuando no tenemos fuerzas.\n\n` +
    `### 5. PREGUNTAS ABIERTAS PARA ROMPER EL HIELO EN LA SALA\n` +
    `* *«¿En qué situaciones sientes más fuerte la presión de ceder o esconder tu fe ante los demás?»*\n` +
    `* *«Si pudieras cambiar una cosa de la manera en que usas tus redes sociales o tu tiempo libre, ¿cuál sería?»*\n` +
    `* *«Al leer [CITA: ${ctx.firstCitation}], ¿qué palabra o frase te pegó más fuerte al corazón hoy?»*\n` +
    `* *«¿Cómo podemos apoyarnos como grupo esta semana para no sentirnos solos en medio de las batallas diarias?»*\n\n` +
    `### 6. DESAFÍO SEMANAL DE IMPACTO («RETO 24/7»)\n` +
    `Durante las próximas 48 horas, desconéctate de las redes sociales por al menos 1 hora antes de dormir. Utiliza ese tiempo para leer con calma [CITA: ${ctx.firstCitation}], poner tu música de alabanza y escribirle un mensaje genuino de ánimo a un amigo que sepas que la está pasando mal sin esperar nada a cambio.\n\n` +
    `### 7. GUÍA DE ORACIÓN EN PAREJAS\n` +
    `Pónganse de pie de dos en dos (varones con varones, mujeres con mujeres). Cada uno comparta una petición sincera: miedo al futuro, problemas familiares, estudios o desánimo. Oren el uno por el otro con sencillez: *«Señor, bendigo a mi hermano/a; guarda su mente de la mentira del enemigo, dale valentía para brillar como luz y llénalo/a de tu paz que sobrepasa todo entendimiento. En el nombre de Jesús, amén»*.\n\n` +
    `💡 *Guía lista para compartir por WhatsApp con los líderes de tu célula.*`
  );
}

/**
 * 4. SERIE_CAMPANA: Plan de 4 Semanas / Discipulado Continuo (> 2,500 caracteres)
 */
export function composeSerieCampana(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const title = ctx.book ? `SERIE MINISTERIAL: ${ctx.book.nombre}` : `CAMPAÑA: ${ctx.topic.toUpperCase()}`;

  return (
    `# ${title}\n` +
    `## Plan Integral de Discipulado y Crecimiento de 4 Semanas para la Iglesia Local\n\n` +
    `**Lema General de la Campaña:** «Caminando de Gloria en Gloria bajo la Gracia Soberana»\n` +
    `**Pasaje Lema Inmutable:** [CITA: ${ctx.firstCitation}]\n` +
    `**Objetivo de la Campaña:** Fortalecer la salud espiritual de la congregación a través de 28 días de lectura guiada, 4 predicaciones expositivas y 4 reuniones de grupos pequeños alineadas temáticamente.\n\n` +
    `---\n\n` +
    `### SEMANA 1: EL FUNDAMENTO INDESTRUCTIBLE\n` +
    `* **Título Homilético del Domingo:** *«El Diagnóstico del Alma y el Abrazo de la Gracia»*\n` +
    `* **Pasaje Base:** [CITA: ${ctx.firstCitation}]\n` +
    `* **Tres Puntos Expositivos:**\n` +
    `  1. *La insuficiencia de las fuerzas humanas:* Por qué los planes sin Dios siempre terminan en desgaste espiritual.\n` +
    `  2. *El pacto sellado en la cruz:* Cómo la gracia divina restaura lo que el pecado intentó destruir.\n` +
    `  3. *Un nuevo comienzo:* Decidir vivir bajo la mirada del Padre y no bajo la condenación del acusador.\n` +
    `* **Reto Semanal para el Creyente:** Identificar y anotar en un papel tres cargas que vienes arrastrando del pasado; orar entregándoselas a Dios y destruyendo simbólicamente esa lista de deudas.\n` +
    `* **Lectura Devocional:** Días 1 al 7 (Capítulos iniciales y Salmos de reposo).\n\n` +
    `### SEMANA 2: EL PROCESO EN EL CRISOL (CRISIS Y PERSEVERANCIA)\n` +
    `* **Título Homilético del Domingo:** *«Cuando la Prueba se Alarga: Fe que no Claudica»*\n` +
    `* **Pasaje Base:** [CITA: ${ctx.secondCitation}]\n` +
    `* **Tres Puntos Expositivos:**\n` +
    `  1. *El propósito oculto en el desierto:* Dios no permite el sufrimiento para destruirnos, sino para podar nuestras ramas.\n` +
    `  2. *Armas espirituales para la batalla mental:* Cómo derribar argumentos de desesperanza usando la Palabra viva.\n` +
    `  3. *Compañeros de milicia:* La importancia vital de no aislarse en tiempos de aflicción.\n` +
    `* **Reto Semanal para el Creyente:** Acercarse a un hermano de la iglesia que esté pasando por una crisis de salud o económica y llevarle provisión material y oración intercesora.\n` +
    `* **Lectura Devocional:** Días 8 al 14 (Historias de fidelidad: José, Daniel y Job).\n\n` +
    `### SEMANA 3: LA TRANSFORMACIÓN INTERIOR (SANTIDAD Y CARÁCTER)\n` +
    `* **Título Homilético del Domingo:** *«La Renovación de la Mente y el Fuego del Altar»*\n` +
    `* **Pasaje Base:** [CITA: ${ctx.thirdCitation}]\n` +
    `* **Tres Puntos Expositivos:**\n` +
    `  1. *El peligro de la conformidad mundana:* Por qué adaptarnos a las modas culturales apaga la unción del creyente.\n` +
    `  2. *El culto racional cotidiano:* La adoración como estilo de vida en la honestidad laboral y la pureza personal.\n` +
    `  3. *El discernimiento de la buena voluntad divina:* Cómo reconocer lo que es agradable y perfecto delante del Señor.\n` +
    `* **Reto Semanal para el Creyente:** Tomar un día completo de ayuno (parcial o total) consagrando las decisiones del hogar y las finanzas al gobierno soberano de Cristo.\n` +
    `* **Lectura Devocional:** Días 15 al 21 (Enseñanzas paulinas sobre el fruto del Espíritu).\n\n` +
    `### SEMANA 4: LA COMISIÓN Y EL IMPACTO MULTIPLICADOR\n` +
    `* **Título Homilético del Domingo:** *«Enviados como Testigos: El Reino en Acción»*\n` +
    `* **Pasaje Base:** [CITA: ${ctx.fourthCitation}]\n` +
    `* **Tres Puntos Expositivos:**\n` +
    `  1. *El mandato de la Gran Comisión:* El Evangelio no fue dado para esconderse en templos, sino para alumbrar naciones.\n` +
    `  2. *Autoridad delegada por el Espíritu:* No vamos en nuestras fuerzas; el Consolador respalda la proclamación de la verdad.\n` +
    `  3. *La cosecha eterna:* Invertir vidas, recursos y oraciones en el avance del Reino de Dios.\n` +
    `* **Reto Semanal para el Creyente:** Compartir el Evangelio cara a cara con al menos dos personas de tu entorno cotidiano e invitarlas a la celebración de cierre de la campaña.\n` +
    `* **Lectura Devocional:** Días 22 al 28 (Hechos de los Apóstoles y visión escatológica).\n\n` +
    `### GUÍA DE AYUNO Y LECTURA CONTINUA DE 28 DÍAS\n` +
    `* **Semana 1:** Ayuno de distracciones digitales (1 hora diaria consagrada a la oración matutina).\n` +
    `* **Semana 2:** Oración de intercesión por las familias de la iglesia y la reconciliación conyugal.\n` +
    `* **Semana 3:** Ayuno Daniel (abstinencia de manjares) buscando purificación del corazón y santidad.\n` +
    `* **Semana 4:** Vigilia congregacional de agradecimiento por los milagros cosechados en el mes.\n\n` +
    `💡 *Esta serie de 4 semanas te ofrece el currículo homilético completo para un mes entero de predicaciones.*`
  );
}

/**
 * 5. PERFIL_PERSONAJE: Biografía Bíblica Exhaustiva (> 2,500 caracteres)
 */
export function composePerfilPersonaje(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const name = ctx.topic;

  return (
    `# BIOGRAFÍA Y PERFIL BÍBLICO EXHAUSTIVO: ${name.toUpperCase()}\n` +
    `## «Lecciones de Carácter, Caídas Humanas y Redención Soberana»\n\n` +
    `**Pasaje de Anclaje:** [CITA: ${ctx.firstCitation}]\n` +
    `**Pasaje Complementario:** [CITA: ${ctx.secondCitation}]\n\n` +
    `---\n\n` +
    `### 1. FICHA BIOGRÁFICA Y MARCO HISTÓRICO\n` +
    `* **Significado Teológico del Nombre:** Cada nombre en el canon bíblico revela un propósito profético, un testimonio de los tratos de Dios con su pueblo o un recordatorio de fidelidad pactual.\n` +
    `* **Época y Ubicación Geográfica:** Se desenvolvió en momentos decisivos de la historia de la salvación, rodeado de imperios dominantes, desiertos áridos y tensiones políticas extremas.\n` +
    `* **Llamado Inicial y Oficio:** No fue escogido por su elocuencia natural ni por su linaje intachable, sino por la soberanía de Aquel que escoge lo vil y menospreciado para avergonzar a los sabios.\n\n` +
    `### 2. CONTEXTO SOCIOCULTURAL Y POLÍTICO DE SU TIEMPO\n` +
    `Para comprender las decisiones de este personaje, debemos situarnos en el polvo de su época. Vivió bajo presiones donde la idolatría era la norma cultural y la fidelidad al Dios único conllevaba el riesgo del desprecio, el exilio o la muerte. Su biografía nos enseña que Dios siempre levanta testigos en las épocas más oscuras de la sociedad.\n\n` +
    `### 3. SUS GRANDES VICTORIAS DE FE\n` +
    `* **La Decisión de Obedecer a Ciegas:** Cuando Dios le ordenó dar pasos sin ver el resultado final, creyó contra toda esperanza natural.\n` +
    `* **El Testimonio de la Palabra:** [CITA: ${ctx.firstCitation}]\n` +
    `* **El Respaldo Sobrenatural:** En sus batallas no venció por el número de sus armas, sino porque aprendió a clamar en lo secreto antes de actuar en público.\n\n` +
    `### 4. CRISIS, DEBILIDADES Y MOMENTOS DE QUEBRANTO\n` +
    `La Biblia nunca oculta las faltas de sus héroes; esa es la prueba más clara de su inspiración divina y autenticidad:\n` +
    `* **La Tentación del Desánimo y el Miedo:** Experimentó noches de angustia donde quiso renunciar o donde dudó de las promesas de Dios ante la amenaza de sus adversarios.\n` +
    `* **El Error de Confiar en la Carne:** En ocasiones intentó ayudar a Dios mediante atajos humanos, cosechando dolor y consecuencias familiares complejas.\n` +
    `* **El Juicio y la Disciplina Paternal:** Dios no pasa por alto el pecado de sus siervos, pero su disciplina tiene como fin la corrección amorosa y no la destrucción.\n\n` +
    `### 5. LA GRACIA QUE RESTAURA Y VUELVE A COMISIONAR\n` +
    `La grandeza de su historia no reside en su perfección moral, sino en la paciencia inagotable de Dios. Tras el quebrantamiento y el genuino arrepentimiento, el Señor no lo desechó; sopló nuevo aliento de vida, renovó su pacto y le otorgó una encomienda todavía mayor.\n` +
    `* **Lectura de Restauración:** [CITA: ${ctx.secondCitation}]\n\n` +
    `### 6. CINCO LECCIONES DE LIDERAZGO PARA EL CREYENTE MODERNO\n` +
    `1. *La comunión íntima precede a la autoridad pública:* Nadie puede sostener un ministerio duradero si su vida de oración privada está en ruinas.\n` +
    `2. *Tus caídas no son la última palabra de Dios:* Mientras haya arrepentimiento sincero, la gracia del Redentor es infinitamente más profunda que cualquiera de tus equivocaciones pasadas.\n` +
    `3. *La soledad del líder se vence con el Dios del pacto:* Cuando todos te abandonen o critiquen, el Señor permanece a tu lado infundiendo aliento.\n` +
    `4. *No tomes atajos en la voluntad divina:* Esperar en el tiempo de Dios es doloroso, pero apresurarse engendra problemas innecesarios.\n` +
    `5. *Deja un legado que trascienda tu generación:* La meta no es ser recordado por los hombres, sino sembrar semillas del Reino que den fruto para la eternidad.\n\n` +
    `💡 *Perfil biográfico exhaustivo listo para estudio devocional o predicación de personajes bíblicos.*`
  );
}

/**
 * 6. DOCTRINA_SISTEMATICA: Estudio Temático / Apologético (> 2,500 caracteres)
 */
export function composeDoctrinaSistematica(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const doctrine = ctx.topic;

  return (
    `# ESTUDIO DE TEOLOGÍA SISTEMÁTICA Y APOLOGÉTICA CANÓNICA\n` +
    `## «Fundamentos Inmutables de la Fe: ${doctrine.toUpperCase()}»\n\n` +
    `**Declaración Confesional Central:** La fe cristiana no descansa en mitologías ni en consensos filosóficos cambiantes, sino en la revelación proposicional infalible de Dios registrada en las Sagradas Escrituras.\n` +
    `**Pasaje Fundamental:** [CITA: ${ctx.firstCitation}]\n` +
    `**Pasaje de Coherencia Sistemática:** [CITA: ${ctx.secondCitation}]\n\n` +
    `---\n\n` +
    `### 1. DEFINICIÓN TEOLÓGICA E HISTÓRICA DEL DOGMA\n` +
    `La doctrina bíblica respecto a ${doctrine} constituye un pilar esencial para la ortodoxia de la iglesia. A lo largo de la historia de los concilios históricos y las confesiones de fe reformadas y evangélicas, este principio ha sido defendido contra el error.\n` +
    `* **Definición Clásica:** La verdad de que Dios es santo, justo, soberano y el único dador de vida y salvación por medio del sacrificio expiatorio de su Hijo.\n` +
    `* **Distorsiones Contemporáneas:** El secularismo y el relativismo moral buscan despojar a este principio de su carácter absoluto, reduciéndolo a una simple preferencia psicológica individual.\n\n` +
    `### 2. DESARROLLO VETEROTESTAMENTARIO (SOMBRAS Y PACTOS EN EL AT)\n` +
    `En el Antiguo Testamento encontramos la semilla y tipología de esta gran verdad. Desde los sacrificios del tabernáculo hasta las profecías mesiánicas, Dios preparó a su pueblo pedagógicamente.\n` +
    `* **El Testimonio Pactual:** [CITA: ${ctx.firstCitation}]\n` +
    `* **La Ley Moral y los Profetas:** Los profetas denunciaron la hipocresía ritualista y recordaron que Dios demanda obediencia del corazón y fe en su promesa redentora.\n\n` +
    `### 3. PLENITUD CRISTOLÓGICA Y APOSTÓLICA EN EL NUEVO TESTAMENTO\n` +
    `Lo que en el Antiguo Testamento era sombra, en el Nuevo Testamento resplandece con claridad meridiana en la encarnación, muerte y resurrección de Jesucristo:\n` +
    `* **La Revelación Encarnada:** [CITA: ${ctx.secondCitation}]\n` +
    `* **La Teología Apostólica:** Los apóstoles consolidaron la doctrina demostrando que Cristo es el cumplimiento y la consumación del pacto eterno.\n\n` +
    `### 4. APOLOGÉTICA: RESPUESTA A TRES OBJECIONES COMUNES\n` +
    `1. *Objeción 1: «Esta doctrina es producto de concilios humanos tardíos y no de las Escrituras originales»*\n` +
    `   * **Refutación Bíblica:** Los textos del primer siglo demuestran que los apóstoles ya creían, enseñaban y vivían esta verdad de manera uniforme.\n` +
    `2. *Objeción 2: «Un Dios de amor no demandaría justicia estricta ni expiación sangrienta»*\n` +
    `   * **Refutación Bíblica:** El amor de Dios no anula su santidad; en la cruz se besaron la justicia y la misericordia, pagando el precio sin rebajar la santidad divina.\n` +
    `3. *Objeción 3: «Todas las religiones llevan al mismo camino y no se puede reclamar exclusividad»*\n` +
    `   * **Refutación Bíblica:** Las Escrituras afirman de forma categórica que no hay otro nombre bajo el cielo dado a los hombres en que podamos ser salvos.\n\n` +
    `### 5. APLICACIÓN PASTORAL Y DOXOLOGÍA FINAL\n` +
    `La sana doctrina nunca conduce al orgullo intelectual, sino a la adoración profunda y a una vida de servicio sacrificial. Cuando contemplamos la grandeza de la revelación de Dios, el alma solo puede exclamar:\n` +
    `*«¡Oh profundidad de las riquezas de la sabiduría y de la ciencia de Dios! ¡Cuán insondables son sus juicios, e inescrutables sus caminos! Porque de él, y por él, y para él, son todas las cosas. A él sea la gloria por los siglos. Amén»*.\n\n` +
    `💡 *Estudio sistemático completo. Puedes fijarlo a tu Pizarra de Estudio y editar sus secciones con anotaciones personales.*`
  );
}

/**
 * 7. CEREMONIA_ESPECIAL: Bodas, Funerales, Santa Cena, Bautismos (> 2,500 caracteres)
 */
export function composeCeremoniaEspecial(prompt: string, availableCitations: string[]): string {
  const ctx = resolveContext(prompt, availableCitations);
  const lower = prompt.toLowerCase();

  let ceremonyName = 'Liturgia Ministerial Solemne';
  let goldenVerse = ctx.firstCitation;

  if (lower.includes('boda') || lower.includes('matrimonio')) {
    ceremonyName = 'Ceremonia Nupcial y Bendición Matrimonial';
    if (!ctx.firstCitation.includes('1 Corintios') && !ctx.firstCitation.includes('Efesios')) {
      goldenVerse = '1 Corintios 13:4-8';
    }
  } else if (lower.includes('funeral') || lower.includes('sepelio')) {
    ceremonyName = 'Servicio Conmemorativo de Esperanza y Sepelio Cristiano';
    goldenVerse = 'Juan 11:25-26';
  } else if (lower.includes('santa cena') || lower.includes('comunion') || lower.includes('comunión')) {
    ceremonyName = 'Celebración Solemne de la Santa Cena del Señor';
    goldenVerse = '1 Corintios 11:23-26';
  } else if (lower.includes('bautismo')) {
    ceremonyName = 'Servicio Solemne de Bautismo en Aguas';
    goldenVerse = 'Romanos 6:3-4';
  }

  return (
    `# ORDEN LITÚRGICO Y HOMILÍA PASTORAL: ${ceremonyName.toUpperCase()}\n` +
    `## Guía Ministerial Paso a Paso para Ministros y Oficiantes\n\n` +
    `**Texto Central de las Escrituras:** [CITA: ${goldenVerse}]\n` +
    `**Duración Total Estimada:** 35 a 45 minutos solemnes\n\n` +
    `---\n\n` +
    `### 1. ORDEN LITÚRGICO MINUTO A MINUTO\n` +
    `* **00:00 - 00:05:** Preludio musical reverente y entrada de participantes u oficiantes.\n` +
    `* **00:05 - 00:10:** Invocación sacerdotal de apertura: bienvenida a la congregación y consagración de la ceremonia al Padre, Hijo y Espíritu Santo.\n` +
    `* **00:10 - 00:15:** Lecturas bíblicas solemnes antiphonales con la congregación.\n` +
    `* **00:15 - 00:30:** Homilía Pastoral Breve (15 minutos enfocados en la gracia y la esperanza inmutable).\n` +
    `* **00:30 - 00:40:** Acto Simbólico / Votos solemnes / Participación de los elementos / Bendición pastoral.\n` +
    `* **00:40 - 00:45:** Oración de clausura y bendición apostólica con música de postludio.\n\n` +
    `### 2. LECTURAS BÍBLICAS SOLEMNES\n` +
    `* **Lectura Inicial:** [CITA: ${goldenVerse}]\n` +
    `* **Lectura de Aliento:** [CITA: ${ctx.secondCitation}]\n\n` +
    `### 3. HOMILÍA PASTORAL (TEXTO ÍNTEGRO PARA EL MINISTRO)\n` +
    `Amada congregación reunida en este momento solemne: estamos congregados bajo la mirada de Dios para ser testigos de una ocasión que trasciende lo terrenal. Cuando nos detenemos ante los grandes hitos de la existencia —el amor de un pacto conyugal, la partida de un ser amado hacia la presencia eterna, o la mesa donde conmemoramos el cuerpo y la sangre de nuestro Redentor—, las palabras humanas se quedan cortas si no están fundadas en la Palabra inmutable del Dios viviente.\n\n` +
    `Las Escrituras nos recuerdan que nuestras vidas están escritas en las palmas de las manos del Creador. Nada de lo que acontece en este día escapa a su providencia soberana. La fe no es una emoción pasajera; es la certeza inquebrantable de que el Señor que inició en nosotros la buena obra la perfeccionará hasta el día final. Por tanto, pongamos nuestros ojos no en las circunstancias visibles que perecen, sino en las invisibles y eternas que jamás pasarán.\n\n` +
    `### 4. VOTOS / ACTO SIMBÓLICO / PALABRAS LITÚRGICAS\n` +
    `*(El ministro se dirige a los participantes con autoridad reverente y calidez pastoral)*:\n` +
    `«Delante de Dios, de los santos ángeles y de esta congregación que actúa como testigo de fe, proclamamos que este acto no se apoya en voluntades humanas efímeras, sino en el pacto eterno del Señor. Que la fidelidad, la santidad y la verdad sean el sello inviolable que guarde cada palabra pronunciada hoy».\n\n` +
    `### 5. ORACIÓN SACERDOTAL DE BENDICIÓN FINAL\n` +
    `*«Jehová te bendiga, y te guarde; Jehová haga resplandecer su rostro sobre ti, y tenga de ti misericordia; Jehová alce sobre ti su rostro, y ponga en ti paz.\n` +
    `Padre Santo, consagramos a ti esta ceremonia. Guarda sus vidas de todo mal, afirma sus pasos en la senda de justicia y que la paz de Cristo reine en sus corazones por siempre jamás. En el nombre del Padre, del Hijo y del Espíritu Santo, ¡amén y amén!»*\n\n` +
    `💡 *Liturgia solemne completa. Puedes fijarla a tu Pizarra de Estudio e imprimirla para llevarla a la ceremonia.*`
  );
}
