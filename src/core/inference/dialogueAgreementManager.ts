import { MinistryFormat, UserTheologicalLevel, TheologicalRoute } from '../shield/types.js';
import { ChatMessage, UserEvolutionProfile } from '../database/usuarioMemoriaService.js';
import { CanonicalBookProfile } from '../database/canonicalBooks.js';
import { BiblicalMirror } from '../rag/casuistryMapper.js';

export interface AgreementResolution {
  isApprovedOrExplicit: boolean;
  targetFormat: MinistryFormat;
  targetTopic?: string;
}

/**
 * Determina si el mensaje del usuario aprueba un acuerdo previo o solicita explícitamente el documento completo,
 * o si se encuentra en fase inicial de diálogo y co-diseño ministerial.
 */
export function resolveUserAgreement(
  prompt: string,
  chatHistory?: ChatMessage[],
  explicitFormat?: MinistryFormat
): AgreementResolution {
  const lower = prompt.toLowerCase().trim();

  // 1. Si el usuario seleccionó un formato específico en la barra superior (distinto de 'AUTO')
  if (explicitFormat && explicitFormat !== 'AUTO') {
    return {
      isApprovedOrExplicit: true,
      targetFormat: explicitFormat,
    };
  }

  // 2. Si el prompt proviene de un botón interactivo [ACUERDO: ...]
  if (lower.includes('[acuerdo:') || lower.startsWith('acuerdo:')) {
    const targetFormat = extractFormatFromText(lower);
    return {
      isApprovedOrExplicit: true,
      targetFormat,
    };
  }

  // 3. Comprobar si el mensaje es una confirmación afirmativa a una propuesta previa del asistente
  const isAffirmative =
    /^(?:s[ií]|claro|de acuerdo|adelante|procede|hazlo|desarr[oó]llalo|perfecto|me parece bien|dale|confirmo|aprobado|apruebo|contin[uú]a|genera(?:lo)?|excelente|vamos)(?:[\s.,!¡?¿]|$)/iu.test(
      lower
    );

  if (isAffirmative && chatHistory && chatHistory.length >= 1) {
    const lastAssistantMsg = [...chatHistory].reverse().find((m) => m.role === 'assistant');
    if (lastAssistantMsg && (lastAssistantMsg.content.includes('[ACUERDO:') || lastAssistantMsg.content.includes('acuerdo de trabajo') || lastAssistantMsg.content.includes('¿Te parece adecuado'))) {
      const targetFormat = extractFormatFromText(lower) !== 'AUTO' 
        ? extractFormatFromText(lower) 
        : extractFormatFromText(lastAssistantMsg.content);

      return {
        isApprovedOrExplicit: true,
        targetFormat: targetFormat !== 'AUTO' ? targetFormat : 'SERMON_CULTO',
      };
    }
  }

  // 4. Si el prompt exige explícitamente redactar el formato final completo sin pasar por acuerdo previo
  const isExplicitCommand =
    lower.includes('completo') ||
    lower.includes('completa') ||
    lower.includes('desarróllalo') ||
    lower.includes('desarrollalo') ||
    lower.includes('genera el sermón') ||
    lower.includes('genera el sermon') ||
    lower.includes('escribe el sermón') ||
    lower.includes('escribe el sermon') ||
    lower.includes('redacta el') ||
    lower.includes('formato final') ||
    lower.includes('dame el bosquejo completo') ||
    lower.includes('guía completa') ||
    lower.includes('guia completa');

  if (isExplicitCommand) {
    const targetFormat = extractFormatFromText(lower);
    return {
      isApprovedOrExplicit: true,
      targetFormat: targetFormat !== 'AUTO' ? targetFormat : 'SERMON_CULTO',
    };
  }

  // 5. En cualquier otro caso, está en modo diálogo y propuesta de acuerdo
  const targetFormat = extractFormatFromText(lower);
  return {
    isApprovedOrExplicit: false,
    targetFormat,
  };
}

/**
 * Deduce el formato ministerial a partir de las palabras clave del texto
 */
export function extractFormatFromText(text: string): MinistryFormat {
  const lower = text.toLowerCase();
  if (lower.includes('escuela dominical') || lower.includes('clase') || lower.includes('pedagogic') || lower.includes('leccion') || lower.includes('lección')) {
    return 'ESTUDIO_CLASE';
  }
  if (lower.includes('célula') || lower.includes('celula') || lower.includes('joven') || lower.includes('grupo pequeño') || lower.includes('grupo pequeno')) {
    return 'CELULA_JOVENES';
  }
  if (lower.includes('serie') || lower.includes('campaña') || lower.includes('campana') || lower.includes('4 semanas') || lower.includes('mes')) {
    return 'SERIE_CAMPANA';
  }
  if (lower.includes('biografia') || lower.includes('biografía') || lower.includes('personaje') || lower.includes('perfil')) {
    return 'PERFIL_PERSONAJE';
  }
  if (lower.includes('doctrina') || lower.includes('sistematica') || lower.includes('sistemática') || lower.includes('apologetica') || lower.includes('herejia') || lower.includes('herejía')) {
    return 'DOCTRINA_SISTEMATICA';
  }
  if (lower.includes('boda') || lower.includes('funeral') || lower.includes('ceremonia') || lower.includes('liturgia') || lower.includes('sepelio')) {
    return 'CEREMONIA_ESPECIAL';
  }
  if (lower.includes('sermon') || lower.includes('sermón') || lower.includes('predica') || lower.includes('prédica') || lower.includes('pulpito') || lower.includes('púlpito') || lower.includes('culto')) {
    return 'SERMON_CULTO';
  }
  return 'AUTO';
}

/**
 * Genera la respuesta en Modo Diálogo y Acuerdo Ministerial (Paso 1: Colaboración & Propuesta de Enfoque)
 */
export function composeDialogueAgreementProposal(params: {
  prompt: string;
  route: TheologicalRoute;
  level: UserTheologicalLevel;
  firstCitation: string;
  secondCitation: string;
  detectedBook?: CanonicalBookProfile | null;
  mirror?: BiblicalMirror | null;
  userProfile?: UserEvolutionProfile | null;
  suggestedFormat?: MinistryFormat;
}): string {
  const { prompt, level, firstCitation, secondCitation, detectedBook, mirror, suggestedFormat } = params;

  // Derivar título o tema del prompt
  const cleanTopic = prompt
    .replace(/(?:quiero|necesito|ayudame|ayúdame|preparar|hacer|dar|un|una|estudio|bosquejo|sermon|sermón|predica|prédica|clase|sobre|de|para|el|la)\s+/gi, ' ')
    .trim();
  const themeTitle = cleanTopic.length > 2 
    ? cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) 
    : (detectedBook ? detectedBook.nombre : (mirror ? mirror.titulo : 'la Revelación Divina'));

  // Propuesta de 3 movimientos homiléticos / pedagógicos preliminares
  let mov1 = 'El Diagnóstico del Corazón: Reconocer la necesidad de la gracia frente a las circunstancias humanas.';
  let mov2 = 'La Promesa Inmutable del Pacto: El reposo y la provisión asegurados en Cristo Jesús.';
  let mov3 = 'El Llamado a la Fe y Obediencia Práctica: Vivir y perseverar con esperanza en la comunidad.';

  if (mirror) {
    mov1 = `El Desafío Humano (${mirror.personaje}): ${mirror.principioCentral}.`;
    mov2 = `La Respuesta de Dios en la Crisis: ${mirror.historiaEspejo}.`;
    mov3 = `Aplicación de Fe: ${mirror.aplicacionPractica[0] || 'Descansar plenamente en la soberanía divina'}.`;
  } else if (detectedBook) {
    mov1 = `Fundamento Canónico: ${detectedBook.puntosExegeticosDiscipulo[0] || detectedBook.temaCentral}.`;
    mov2 = `El Corazón del Pacto: ${detectedBook.puntosExegeticosDiscipulo[1] || 'La fidelidad divina manifiesta en su pueblo'}.`;
    mov3 = `Horizonte Pastoral: La respuesta en santidad y comunión guiada por el Espíritu.`;
  }

  const preferredFormatLabel =
    suggestedFormat === 'ESTUDIO_CLASE'
      ? 'Lección de Escuela Dominical'
      : suggestedFormat === 'CELULA_JOVENES'
      ? 'Guía de Célula / Jóvenes'
      : suggestedFormat === 'SERIE_CAMPANA'
      ? 'Serie de Campaña (4 Semanas)'
      : suggestedFormat === 'PERFIL_PERSONAJE'
      ? 'Biografía de Personaje Bíblico'
      : suggestedFormat === 'DOCTRINA_SISTEMATICA'
      ? 'Tratado de Doctrina Sistemática'
      : suggestedFormat === 'CEREMONIA_ESPECIAL'
      ? 'Liturgia de Ceremonia Especial'
      : 'Sermón Expositivo de Culto';

  return (
    `### Diálogo Pastoral y Propuesta de Acuerdo: ${themeTitle}\n\n` +
    `Es una bendición trabajar juntos en la preparación de este contenido sobre **${themeTitle}**. Como tu mentor teológico, antes de que las herramientas del sistema redacten el formato completo y estructurado, acordemos el rumbo para que ministre con exactitud a tu audiencia:\n\n` +
    `**Fundamento Canónico Inicial:**\n` +
    `> [CITA: ${firstCitation}]\n\n` +
    `*(Referencia de apoyo intertextual: [CITA: ${secondCitation}])* \n\n` +
    `**Propuesta de Movimientos y Enfoque:**\n` +
    `1. **${mov1}**\n` +
    `2. **${mov2}**\n` +
    `3. **${mov3}**\n\n` +
    `---\n\n` +
    `**Acuerdos y Formatos Disponibles (Toca una opción o indícame tus ajustes):**\n\n` +
    `[ACUERDO: Desarrollar ${preferredFormatLabel} Completo]\n` +
    `[ACUERDO: Desarrollar Lección de Escuela Dominical]\n` +
    `[ACUERDO: Desarrollar Guía para Célula / Jóvenes]\n` +
    `[ACUERDO: Desarrollar Exégesis con Raíces Strong]\n\n` +
    `💬 *¿Te parece adecuado este rumbo de 3 puntos para tu audiencia (${level}), o deseas enfatizar alguna necesidad particular antes de que las herramientas generen el formato completo?*`
  );
}

/**
 * Envuelve el documento extenso aprobado con diálogo pastoral afirmativo y seguimiento ping-pong
 */
export function wrapApprovedDocumentWithDialogue(
  documentBody: string,
  _targetFormat: MinistryFormat,
  _prompt: string
): string {

  let introGreeting =
    `¡Excelente acuerdo! Con el rumbo definido y la verdad central concertada, he activado las herramientas teológicas para desarrollar tu documento completo con máxima fidelidad canónica:\n\n`;

  let pingPongClosing =
    `\n\n---\n` +
    `### Seguimiento Pastoral en Diálogo\n` +
    `Este documento ha sido generado conforme a nuestro acuerdo ministerial. Puedes guardarlo en tu **Pizarra de Estudio** usando el botón **«Fijar»** para personalizarlo o exportarlo a PDF y WhatsApp.\n\n` +
    `* ¿Cómo planeas enfocar la conclusión y ministración final según la necesidad de quienes escucharán?\n` +
    `* ¿Deseas que preparemos las preguntas de discusión para líderes o una ilustración contemporánea adicional?`;

  return `${introGreeting}${documentBody}${pingPongClosing}`;
}
