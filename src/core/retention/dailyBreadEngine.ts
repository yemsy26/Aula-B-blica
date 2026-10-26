import { UsuarioMemoriaService } from '../database/usuarioMemoriaService.js';
import { BibliaCoreService } from '../database/bibliaCoreService.js';
import { DailyBreadCardData } from './types.js';

export class DailyBreadEngine {
  /**
   * Genera el devocional matutino personalizado conectando la memoria evolutiva con el canon inmutable
   */
  static generateDailyBread(
    usuarioService: UsuarioMemoriaService,
    bibliaService: BibliaCoreService,
    activeVersion: string = 'RV1909'
  ): DailyBreadCardData {
    const profile = usuarioService.getGlobalProfile();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Analizar temas recientes del usuario o dudas pendientes
    const studiedTopics = profile.temas_estudiados.map((t) => t.tema.toLowerCase());
    const level = profile.nivel_espiritual;

    let targetBook = 'Salmos';
    let targetCap = 23;
    let targetVer = 1;
    let tema = 'El Cuidado Inquebrantable de Dios';
    let reflexion =
      'En medio de las presiones de esta jornada, recuerda que no caminas huérfano. El Buen Pastor conoce el sendero y provee descanso a tu espíritu.';
    let pregunta = '¿Qué carga específica puedes entregar hoy en las manos del Señor para caminar en paz?';

    if (studiedTopics.some((t) => t.includes('gracia') || t.includes('perdon') || t.includes('culpa'))) {
      targetBook = 'Efesios';
      targetCap = 2;
      targetVer = 8;
      tema = 'Descansando en la Gracia Inmerecida';
      reflexion =
        'Tu aceptación ante Dios no depende de tus logros de hoy, sino de la obra consumada de Cristo. Eres amado por gracia pura.';
      pregunta = '¿Cómo cambia tu perspectiva al recordar que tu valor ante Dios es un regalo y no una deuda?';
    } else if (studiedTopics.some((t) => t.includes('ansiedad') || t.includes('consuelo') || t.includes('miedo'))) {
      targetBook = 'Isaías';
      targetCap = 41;
      targetVer = 10;
      tema = 'Fortaleza en el Valle del Temor';
      reflexion =
        'Cuando el temor intente nublar tus decisiones hoy, aférrate a la diestra de Su justicia. Él no llega tarde ni se fatiga.';
      pregunta = '¿En qué área de tu vida necesitas recordar hoy que el Señor está verdaderamente contigo?';
    } else if (studiedTopics.some((t) => t.includes('creacion') || t.includes('soberania') || t.includes('origen'))) {
      targetBook = 'Génesis';
      targetCap = 1;
      targetVer = 3;
      tema = 'La Luz que Disipa el Caos';
      reflexion =
        'El mismo Dios que con una sola palabra ordenó el cosmos tiene el poder de traer claridad y luz a cualquier confusión en tu mente.';
      pregunta = '¿Qué situación desordenada en tu día pondrás hoy bajo la luz soberana de la Palabra?';
    } else if (studiedTopics.some((t) => t.includes('pacto') || t.includes('amor'))) {
      targetBook = 'Juan';
      targetCap = 3;
      targetVer = 16;
      tema = 'La Medida del Amor Eterno';
      reflexion =
        'El amor divino no fue una declaración vacía; se manifestó en entrega sacrificial. Nada de lo que ocurra hoy puede separarte de ese amor.';
      pregunta = '¿A quién puedes reflejar hoy un destello del amor sacrificial que recibiste de Cristo?';
    }

    // 2. Extraer texto literal de SQLite inmutable
    const verseObj = bibliaService.getVerse(targetBook, targetCap, targetVer, activeVersion) ||
      bibliaService.getVerse(targetBook, targetCap, targetVer, 'RV1909');

    const verseText = verseObj
      ? verseObj.texto
      : 'JEHOVA es mi pastor; nada me faltará.';
    const refStr = `${targetBook} ${targetCap}:${targetVer}`;

    return {
      id: `pan_diario_${today}`,
      fecha: today,
      temaRelacionado: tema,
      versiculoReferencia: refStr,
      versiculoTexto: verseText,
      version: verseObj?.version || 'RV1909',
      reflexionPastoral: reflexion,
      preguntaDelDia: pregunta,
      nivelUsuario: level,
    };
  }
}
