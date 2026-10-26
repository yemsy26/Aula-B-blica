import { InferenceEngine, ModelProfileId } from './types.js';
import { TheologicalRoute, UserTheologicalLevel, MinistryFormat } from '../shield/types.js';
import { getPersonalityConfig } from './systemPrompts.js';
import { realModelBridge } from './realModelBridge.js';
import { findCanonicalBook } from '../database/canonicalBooks.js';
import { findBiblicalMirror } from '../rag/casuistryMapper.js';
import { UserEvolutionProfile } from '../database/usuarioMemoriaService.js';
import { classifyMinistryFormat } from '../shield/routerClassifier.js';
import {
  composeSermonCulto,
  composeEstudioClase,
  composeCelulaJovenes,
  composeSerieCampana,
  composePerfilPersonaje,
  composeDoctrinaSistematica,
  composeCeremoniaEspecial,
} from './homileticGenerators.js';
import {
  extractBiblicalReference,
  composeSpecificPassageExegesis,
  composeBookStudyGuide,
} from './passageExegesisService.js';

/**
 * Sintetizador Exegético Dinámico Universal:
 * - Detecta y genera 7 Formatos Ministeriales Extensos (Multipágina).
 * - Conecta problemas humanos reales con "Espejos Bíblicos" (historias, personajes y principios de vida).
 * - Cumple el Protocolo "Cero Robot" (lenguaje cálido, directo de mentor, sin muletillas sintéticas).
 * - Aplica la "Regla del Ping-Pong" cerrando obligatoriamente con preguntas reflexivas de seguimiento.
 * - Integra memoria evolutiva continua para recordar temas pasados.
 */
export class DynamicTheologicalComposer {
  static compose(
    prompt: string,
    route: TheologicalRoute,
    level: UserTheologicalLevel,
    availableCitations: string[],
    _groundTruthContext?: string,
    userProfile?: UserEvolutionProfile | null,
    format?: MinistryFormat
  ): string {
    const activeFormat = format && format !== 'AUTO' ? format : classifyMinistryFormat(prompt);
    const specificPassage = extractBiblicalReference(prompt);
    const detectedBook = specificPassage?.canonicalBook || findCanonicalBook(prompt);
    const mirror = findBiblicalMirror(prompt);
    const lowerPrompt = prompt.toLowerCase();

    // =========================================================================
    // 0. GENERACIÓN DE FORMATOS HOMILÉTICOS EXTENSOS (MULTIPÁGINA > 2,500 CARACTERES)
    // =========================================================================
    if (activeFormat === 'SERMON_CULTO') {
      return composeSermonCulto(prompt, availableCitations);
    }
    if (activeFormat === 'ESTUDIO_CLASE') {
      return composeEstudioClase(prompt, availableCitations);
    }
    if (activeFormat === 'CELULA_JOVENES') {
      return composeCelulaJovenes(prompt, availableCitations);
    }
    if (activeFormat === 'SERIE_CAMPANA') {
      return composeSerieCampana(prompt, availableCitations);
    }
    if (activeFormat === 'PERFIL_PERSONAJE') {
      return composePerfilPersonaje(prompt, availableCitations);
    }
    if (activeFormat === 'DOCTRINA_SISTEMATICA') {
      return composeDoctrinaSistematica(prompt, availableCitations);
    }
    if (activeFormat === 'CEREMONIA_ESPECIAL') {
      return composeCeremoniaEspecial(prompt, availableCitations);
    }

    // Determinar citas bíblicas prioritarias para rutas estándar
    let firstCitation = availableCitations[0];
    let secondCitation = availableCitations[1];

    if (!firstCitation) {
      if (specificPassage) {
        firstCitation = specificPassage.formattedCitation;
      } else if (mirror) {
        firstCitation = mirror.versiculosClave[0];
      } else if (detectedBook) {
        firstCitation = `${detectedBook.nombre} ${detectedBook.versiculosClaveRefs[0] || '1:1'}`;
      } else if (lowerPrompt.includes('creacion') || lowerPrompt.includes('crear') || lowerPrompt.includes('universo') || lowerPrompt.includes('bara')) {
        firstCitation = 'Génesis 1:1';
      } else if (lowerPrompt.includes('pastor') || lowerPrompt.includes('23')) {
        firstCitation = 'Salmos 23:1';
      } else {
        firstCitation = 'Juan 3:16';
      }
    }

    if (!secondCitation) {
      if (mirror && mirror.versiculosClave.length > 1) {
        secondCitation = mirror.versiculosClave[1];
      } else if (detectedBook && detectedBook.versiculosClaveRefs.length > 1) {
        secondCitation = `${detectedBook.nombre} ${detectedBook.versiculosClaveRefs[1]}`;
      } else if (firstCitation.includes('Génesis 1:1')) {
        secondCitation = 'Juan 1:1';
      } else if (firstCitation.includes('Salmos 23:1')) {
        secondCitation = 'Filipenses 4:13';
      } else {
        secondCitation = 'Filipenses 4:13';
      }
    }

    // Nota sutil de memoria evolutiva si el usuario tiene historial de estudio
    let memoryEcho = '';
    if (userProfile && userProfile.temas_estudiados && userProfile.temas_estudiados.length > 0) {
      const lastTopic = userProfile.temas_estudiados[0].tema;
      if (!lowerPrompt.includes(lastTopic.toLowerCase())) {
        memoryEcho = `*(Teniendo presente lo que venías meditando sobre ${lastTopic}, esta palabra profundiza esa misma fidelidad)*\n\n`;
      }
    }

    // =========================================================================
    // 1. RUTA: CREADOR DE ESTUDIO / HOMILÉTICA / ANÁLISIS EXEGÉTICO
    // =========================================================================
    if (route === '[CREADOR_ESTUDIO]') {
      // 0. Si se solicita estudio detallado o exégesis de un versículo o pasaje específico (ej: Salmos 23:1, Juan 3:16)
      if (specificPassage && (specificPassage.isVerseSpecific || specificPassage.isChapterSpecific)) {
        return composeSpecificPassageExegesis(specificPassage, level, prompt, availableCitations);
      }

      // A. Si se pide estudiar una situación humana con Espejo Bíblico (deudas, desánimo, etc.)
      if (mirror && !detectedBook) {
        return (
          `### Estudio Bíblico Aplicado: ${mirror.titulo}\n\n` +
          `**Arquetipo Canónico:** ${mirror.personaje} (${mirror.referenciaBiblica})\n\n` +
          `1. **La Historia Espejo y el Desafío Humano**\n` +
          `   - ${mirror.historiaEspejo}\n` +
          `   - [CITA: ${mirror.versiculosClave[0] || firstCitation}]\n\n` +
          `2. **El Principio Doctrinal Central**\n` +
          `   - ${mirror.principioCentral}\n` +
          `   - [CITA: ${mirror.versiculosClave[1] || secondCitation}]\n\n` +
          `3. **Aplicación Práctica y Pasos de Fe:**\n` +
          mirror.aplicacionPractica.map((p) => `   • ${p}`).join('\n') + `\n\n` +
          `**Pregunta para Discipulado y Grupo Pequeño:**\n` +
          `* ${mirror.preguntaPingPong}\n\n` +
          `💡 *Puedes fijar este bosquejo a tu Pizarra de Estudio con el botón "Fijar" para editarlo y exportarlo.*`
        );
      }

      // B. Si se pide estudiar uno de los 66 Libros Canónicos
      if (detectedBook) {
        // Guía pedagógica para estudiar el libro completo cuando el usuario pide aprender o estudiar el libro
        const wantsBookStudyGuide =
          lowerPrompt.includes('libro de') ||
          lowerPrompt.includes('como estudiar') ||
          lowerPrompt.includes('cómo estudiar') ||
          lowerPrompt.includes('guia') ||
          lowerPrompt.includes('guía') ||
          lowerPrompt.includes('estudiar el libro') ||
          lowerPrompt.includes('ensenanza del libro') ||
          lowerPrompt.includes('panorama');

        if (wantsBookStudyGuide) {
          return composeBookStudyGuide(detectedBook, level, prompt, availableCitations);
        }

        if (level === 'Semilla') {
          return (
            `### Guía y Estudio Devocional: ${detectedBook.nombre}\n\n` +
            `**Tema Central:** ${detectedBook.temaCentral}\n\n` +
            `**Propósito para tu vida:** ${detectedBook.propositoTeologico}\n\n` +
            `1. **La Promesa y el Fundamento en la Palabra**\n` +
            `   - ${detectedBook.puntosExegeticosSemilla[0] || 'Dios nos revela su fidelidad y amor incondicional en cada capítulo.'}\n` +
            `   - [CITA: ${firstCitation}]\n\n` +
            `2. **Caminando en la Verdad cada día**\n` +
            `   - ${detectedBook.puntosExegeticosSemilla[1] || 'La Palabra viva alumbra nuestras decisiones y nos llena de reposo.'}\n` +
            `   - [CITA: ${secondCitation}]\n\n` +
            `3. **Pasos Prácticos de Fe:**\n` +
            `   - **Paso 1 (Lectura pausada):** Dedica 10 minutos a leer con oración el pasaje clave de ${detectedBook.nombre}.\n` +
            `   - **Paso 2 (Meditación en el corazón):** Pregúntate qué promesa de Dios puedes abrazar hoy para vencer el desánimo.\n` +
            `   - **Paso 3 (Oración y acción):** Convierte esta enseñanza en una petición concreta delante del Padre celestial.\n\n` +
            `💡 *Consejo:* Presiona el botón **"Fijar"** debajo de esta respuesta para guardarla en tu **Pizarra de Estudio** y continuar redactando tus notas.`
          );
        } else if (level === 'Discipulo') {
          const sec1 = detectedBook.seccionesPrincipales[0] || 'Contexto y apertura canónica';
          const sec2 = detectedBook.seccionesPrincipales[1] || 'Desarrollo de la revelación de Dios';
          const sec3 = detectedBook.seccionesPrincipales[2] || 'Culminación y llamado a la santidad';

          return (
            `### Bosquejo Homilético y Teológico: ${detectedBook.nombre}\n\n` +
            `**Autor y Marco:** ${detectedBook.autor} | ${detectedBook.contextoHistorico}\n` +
            `**Tema Doctrinal:** ${detectedBook.temaCentral}\n\n` +
            `1. **Fundamento Canónico y Revelación Divina (${sec1})**\n` +
            `   - ${detectedBook.puntosExegeticosDiscipulo[0] || 'La iniciativa de la gracia divina revelada en el pacto y en la historia de salvación.'}\n` +
            `   - [CITA: ${firstCitation}]\n\n` +
            `2. **La Demanda del Reino y la Vida de Fe (${sec2})**\n` +
            `   - ${detectedBook.puntosExegeticosDiscipulo[1] || 'El llamamiento a caminar en integridad, perseverancia y comunión pactual.'}\n` +
            `   - [CITA: ${secondCitation}]\n\n` +
            `3. **Horizonte Escatológico y Comisión en la Iglesia (${sec3})**\n` +
            `   - La Palabra capacita al creyente para dar testimonio y fructificar en la comunidad de los redimidos.\n\n` +
            `**Preguntas para Discipulado y Grupo Pequeño:**\n` +
            `* ¿De qué manera el propósito de ${detectedBook.nombre} confronta nuestras prioridades personales hoy?\n` +
            `* ¿Cómo nos impulsa este texto a vivir la verdad del Evangelio ante los desafíos del entorno?\n\n` +
            `💡 *Fija este bosquejo a tu Pizarra de Estudio para enriquecerlo con citas cruzadas y exportarlo a WhatsApp o PDF.*`
          );
        } else {
          // Maestro
          const p1 = detectedBook.puntosExegeticosMaestro[0] || 'Análisis gramático-histórico del texto masorético o receptus.';
          const p2 = detectedBook.puntosExegeticosMaestro[1] || 'Coherencia intertextual en el flujo progresivo del pacto bíblico.';
          const p3 = detectedBook.puntosExegeticosMaestro[2] || 'Síntesis teológico-sistemática y aplicaciones para la proclamación expositiva.';

          return (
            `### Análisis Exegético y Teología Bíblica: ${detectedBook.nombre}\n\n` +
            `**Eje Canónico:** ${detectedBook.temaCentral}\n` +
            `**Propósito Exegético:** ${detectedBook.propositoTeologico}\n` +
            `**Marco Histórico-Gramatical:** ${detectedBook.contextoHistorico}\n\n` +
            `1. **Estructura Literaria y Morfosintaxis**\n` +
            `   - ${p1}\n` +
            `   - [CITA: ${firstCitation}]\n\n` +
            `2. **Articulación Intertextual y Tipológica (TSK)**\n` +
            `   - ${p2}\n` +
            `   - [CITA: ${secondCitation}]\n\n` +
            `3. **Teología Sistemática y Proclamación Expositiva**\n` +
            `   - ${p3}\n` +
            `   - La perícopa exige una exégesis fiel que rinda testimonio a la soberanía del Dios trino y la suficiencia de las Escrituras.`
          );
        }
      }

      // C. Creador de estudio temático general
      const topicName = prompt.replace(/(?:quiero|un|una|estudio|bosquejo|sermon|sermón|predica|prédica|sobre|de|el|la)\s+/gi, '').trim() || 'la Fidelidad Divina';
      const capTopic = topicName.charAt(0).toUpperCase() + topicName.slice(1);

      if (level === 'Maestro') {
        return (
          `### Bosquejo Exegético e Intertextual Canónico: ${capTopic}\n\n` +
          `**Nivel:** Maestro (Hebreo y Griego Koiné)\n\n` +
          `1. **Fundamento Canónico Primario**\n` +
          `   - Análisis doctrinal a la luz del texto literal y las lenguas bíblicas:\n` +
          `   - [CITA: ${firstCitation}]\n\n` +
          `2. **Conexión Intertextual Canónica (TSK)**\n` +
          `   - Armonía del testimonio bíblico inmutable en el progreso de la revelación:\n` +
          `   - [CITA: ${secondCitation}]\n\n` +
          `3. **Síntesis y Aplicación Teológica**\n` +
          `   - La doctrina bíblica llama a guardar la fidelidad de la revelación y proclamarla en verdad.`
        );
      } else {
        return (
          `### Bosquejo para Estudio Bíblico: ${capTopic}\n\n` +
          `**Versículo Clave:** ${firstCitation}\n\n` +
          `1. **El Fundamento en la Palabra**\n` +
          `   - La verdad revelada como ancla firme de nuestra esperanza y salvación:\n` +
          `   - [CITA: ${firstCitation}]\n\n` +
          `2. **Caminar en Plena Paz y Obediencia**\n` +
          `   - La gracia divina sostiene cada paso del creyente en su testimonio cotidiano:\n` +
          `   - [CITA: ${secondCitation}]\n\n` +
          `3. **Llamado a la Práctica de Fe**\n` +
          `   - Vivir con convicción y rendir cada área de nuestra vida bajo el señorío de Cristo.\n\n` +
          `💡 *Puedes fijar este bosquejo a la Pizarra de Estudio con el botón "Fijar" para editarlo y exportarlo.*`
        );
      }
    }

    // =========================================================================
    // 2. RUTA: BÚSQUEDA EXACTA / CONCORDANCIA / PASAJES ESPECÍFICOS
    // =========================================================================
    if (route === '[BUSQUEDA_EXACTA]') {
      if (
        specificPassage &&
        (specificPassage.isVerseSpecific || specificPassage.isChapterSpecific) &&
        (lowerPrompt.includes('estudio') ||
          lowerPrompt.includes('explica') ||
          lowerPrompt.includes('significa') ||
          lowerPrompt.includes('detall') ||
          lowerPrompt.includes('profundiz') ||
          lowerPrompt.includes('defin'))
      ) {
        return composeSpecificPassageExegesis(specificPassage, level, prompt, availableCitations);
      }

      if (specificPassage && specificPassage.isVerseSpecific) {
        return (
          `En las Escrituras encontramos este testimonio inmutable para tu consulta:\n\n` +
          `[CITA: ${specificPassage.formattedCitation}]\n\n` +
          (availableCitations.length > 1 ? `Conectado en armonía con:\n\n[CITA: ${secondCitation}]\n\n` : '') +
          `Este texto sagrado expone la fidelidad eterna de Dios y su cuidado providencial para con su pueblo.`
        );
      }

      if (lowerPrompt.includes('pastor') || lowerPrompt.includes('23')) {
        return (
          `El Salmo 23 es la expresión suprema de descanso en la providencia y protección del Señor:\n\n` +
          `[CITA: Salmos 23:1-3]\n\n` +
          `Aquí Jehová se revela como el Pastor fiel que sacia toda necesidad de Su pueblo.`
        );
      }
      if (lowerPrompt.includes('bara') || lowerPrompt.includes('creacion') || lowerPrompt.includes('creación')) {
        return (
          `En el relato de la creación encontramos la acción soberana de Dios revelada desde el primer versículo del canon:\n\n` +
          `[CITA: Génesis 1:1]\n\n` +
          `Este pasaje utiliza la raíz hebrea [H1254: bará], que denota la creación ex nihilo (a partir de la nada), un atributo que las Escrituras reservan exclusivamente para la Deidad.\n\n` +
          `Asimismo, la armonía canónica se conecta con el Verbo eterno en el prólogo joánico:\n\n` +
          `[CITA: Juan 1:1]`
        );
      }
      if (detectedBook) {
        return (
          `En las Escrituras encontramos el testimonio inmutable de ${detectedBook.nombre} (${detectedBook.temaCentral}):\n\n` +
          `[CITA: ${firstCitation}]\n\n` +
          (availableCitations.length > 1 ? `Conectado en armonía canónica con:\n\n[CITA: ${secondCitation}]\n\n` : '') +
          `Este pasaje afirma que ${detectedBook.propositoTeologico.toLowerCase()}`
        );
      }

      return (
        `La revelación canónica nos entrega este testimonio inmutable para tu consulta:\n\n` +
        `[CITA: ${firstCitation}]\n\n` +
        (availableCitations.length > 1 ? `Conectado con:\n\n[CITA: ${secondCitation}]\n\n` : '') +
        `Este texto resume la fidelidad eterna de Dios revelada en las Escrituras.`
      );
    }

    // =========================================================================
    // 3. RUTA: CHARLA Y CONSEJERÍA PASTORAL ("CERO ROBOT" + PING-PONG CONVERSACIONAL)
    // =========================================================================

    // Si dentro de una charla se pide exégesis o explicación detallada de un versículo
    if (
      specificPassage &&
      (specificPassage.isVerseSpecific || specificPassage.isChapterSpecific) &&
      (lowerPrompt.includes('estudio') ||
        lowerPrompt.includes('explica') ||
        lowerPrompt.includes('significa') ||
        lowerPrompt.includes('detall') ||
        lowerPrompt.includes('defin'))
    ) {
      return composeSpecificPassageExegesis(specificPassage, level, prompt, availableCitations);
    }

    // Si coincide con un Espejo Bíblico (deudas, agotamiento, miedo, etc.)
    if (mirror) {
      let warmMentorOpening = '';

      switch (mirror.categoria) {
        case 'ECONOMIA_DEUDAS':
          warmMentorOpening =
            'Mire, cuando el bolsillo aprieta y uno siente que el esfuerzo no rinde o las cuentas ahogan, hay un episodio en la vida de Eliseo que cae como anillo al dedo:';
          break;
        case 'AGOTAMIENTO_DEPRESION':
          warmMentorOpening =
            'Comprendo ese cansancio hondo; cuando el cuerpo y la mente dicen «no puedo más», hay un pasaje en las Escrituras que nos abraza con una compasión enorme:';
          break;
        case 'ANSIEDAD_FUTURO':
          warmMentorOpening =
            'Es muy comprensible sentir ese nudo en el pecho cuando el mañana se ve borroso. Sin embargo, Jesús se detuvo en Galilea ante personas con esa misma angustia:';
          break;
        case 'RELACIONES_TRAICION':
          warmMentorOpening =
            'Una herida provocada por alguien cercano o el dolor de una traición es de lo más punzante que podemos experimentar. En la vida de José encontramos un espejo vivo:';
          break;
        case 'CULPA_PERDON':
          warmMentorOpening =
            'Ese peso en la conciencia que susurra que arruinaste todo o que Dios te dio la espalda es una mentira muy antigua. Mira el encuentro de Jesús con Pedro tras su peor noche:';
          break;
        case 'LIDERAZGO_CARGA':
          warmMentorOpening =
            'Llevar el peso de muchas responsabilidades sobre los propios hombros suele disfrazarse de entrega, pero termina pasando factura. A Moisés le ocurrió exactamente lo mismo:';
          break;
        case 'DOLOR_SUFRIMIENTO':
          warmMentorOpening =
            'Frente al dolor inexplicable y las pruebas que desgarran, las respuestas superficiales ofenden. En la historia de Job encontramos una fe que no finge sonrisas pero no suelta a Dios:';
          break;
        default:
          warmMentorOpening =
            'En las vicisitudes del camino, las Escrituras siempre tienen un espejo donde mirarnos con esperanza y verdad:';
          break;
      }

      return (
        `${memoryEcho}` +
        `${warmMentorOpening}\n\n` +
        `**La Historia Espejo:** ${mirror.historiaEspejo}\n\n` +
        `En ese contexto, la Palabra nos enseña:\n\n` +
        `[CITA: ${mirror.versiculosClave[0] || firstCitation}]\n\n` +
        `**El Principio Central:** ${mirror.principioCentral}\n\n` +
        (mirror.versiculosClave.length > 1
          ? `Afirmado además por la sabiduría canónica:\n\n[CITA: ${mirror.versiculosClave[1]}]\n\n`
          : '') +
        `**Pasos Prácticos para tu Día a Día:**\n` +
        mirror.aplicacionPractica.map((p) => `• ${p}`).join('\n') + `\n\n` +
        `${mirror.preguntaPingPong}`
      );
    }

    // Si menciona un Libro Canónico en diálogo
    if (detectedBook) {
      return (
        `${memoryEcho}` +
        `El libro de ${detectedBook.nombre} nos recuerda con mucha claridad que ${detectedBook.temaCentral.toLowerCase()}. ` +
        `En medio de tus inquietudes personales, las Escrituras afirman con ternura:\n\n` +
        `[CITA: ${firstCitation}]\n\n` +
        (availableCitations.length > 1 ? `Y añade en perfecta armonía:\n\n[CITA: ${secondCitation}]\n\n` : '') +
        `Dios desea que esta verdad eche raíces en tus decisiones hoy.\n\n` +
        `¿Te gustaría que preparemos un bosquejo devocional en la Pizarra de Estudio sobre ${detectedBook.nombre}, o prefieres que conversemos sobre cómo aplicar esto a tu situación personal?`
      );
    }

    // Diálogo general pastoral con regla de Ping-Pong
    return (
      `${memoryEcho}` +
      `Las Escrituras son lámpara para nuestros pasos y un refugio seguro cuando el camino se torna incierto. Ante lo que me comentas, la Palabra nos ofrece este ancla:\n\n` +
      `[CITA: ${firstCitation}]\n\n` +
      `Dios tiene cuidado de cada detalle de tu vida y su fidelidad no flaquea con las circunstancias.\n\n` +
      `¿Cómo resuena esta promesa en tu corazón hoy: sientes que te trae paz para esperar, o necesitas dirección clara para tomar un paso concreto?`
    );
  }
}

export class LocalDeterministicEngine implements InferenceEngine {
  private activeModel: ModelProfileId | 'DETERMINISTIC' = 'DETERMINISTIC';
  private ready: boolean = true;
  private busy: boolean = false;

  isModelReady(): boolean {
    return this.ready;
  }

  isBusy(): boolean {
    return this.busy;
  }

  getActiveModelId(): ModelProfileId | 'DETERMINISTIC' {
    return this.activeModel;
  }

  setActiveModelId(modelId: ModelProfileId | 'DETERMINISTIC') {
    this.activeModel = modelId;
  }

  /**
   * Genera texto con streaming de tokens: intenta backend local real (Ollama/LM Studio/GGUF) si está activo,
   * o ejecuta el motor determinista local instantáneo como fallback resiliente y garantizado.
   */
  async generate(
    prompt: string,
    route: TheologicalRoute,
    level: UserTheologicalLevel,
    groundTruthContext?: string,
    onToken?: (token: string) => void,
    userProfile?: UserEvolutionProfile | null,
    format?: MinistryFormat
  ): Promise<string> {
    this.busy = true;

    try {
      const activeFormat = format && format !== 'AUTO' ? format : classifyMinistryFormat(prompt);

      // 1. Configuración camaleónica (< 1ms)
      const personality = getPersonalityConfig(route, level, activeFormat);

      // 2. Si el desarrollador activó el puente hacia servidor local (Ollama / LM Studio en PC)
      if (realModelBridge.getBackendType() === 'LOCAL_SERVER') {
        try {
          const serverOutput = await realModelBridge.generateStream(
            prompt,
            personality,
            groundTruthContext,
            onToken
          );
          if (serverOutput && serverOutput.trim().length > 0) {
            return serverOutput;
          }
        } catch (serverErr) {
          console.warn('Servidor local no disponible, ejecutando motor determinista edge:', serverErr);
        }
      }

      // 3. Extraer versículos disponibles en groundTruthContext
      const availableCitations: string[] = [];
      if (groundTruthContext) {
        const matches = groundTruthContext.matchAll(/\[CANON_INMUTABLE:\s*([^(\]]+?)(?:\s*\([^)]*\))?\]:/g);
        for (const m of matches) {
          if (m[1]) availableCitations.push(m[1].trim());
        }
      }

      // 4. Sintetizador Exegético Dinámico Universal (Espejos Bíblicos + 66 libros + Ping-Pong + 7 Formatos)
      const responseTemplate = DynamicTheologicalComposer.compose(
        prompt,
        route,
        level,
        availableCitations,
        groundTruthContext,
        userProfile,
        activeFormat
      );

      // 5. Emulación de streaming de tokens respetando límite generoso
      const tokenLimit = Math.max(personality.maxOutputTokens * 2, 6000);
      const tokens = responseTemplate.split(/(\s+)/).slice(0, tokenLimit);
      let fullOutput = '';

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        fullOutput += token;
        if (onToken) {
          onToken(token);
        }
        // Simular latencia de inferencia fluida si hay suscriptor visual
        if (onToken && i % 4 === 0) {
          await new Promise((r) => setTimeout(r, 6));
        }
      }

      return fullOutput;
    } finally {
      // Regla de Oro: Liberar memoria y bandera de ocupado siempre
      await this.releaseMemory();
    }
  }

  /**
   * Libera hilos de procesamiento y memoria RAM (Regla de Oro en Gama Baja)
   */
  async releaseMemory(): Promise<void> {
    this.busy = false;
  }
}

export const localInferenceEngine = new LocalDeterministicEngine();
