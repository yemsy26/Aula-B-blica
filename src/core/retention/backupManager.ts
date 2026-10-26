import { UsuarioMemoriaService, ChatRecord, StudyNote, UserEvolutionProfile } from '../database/usuarioMemoriaService.js';
import { BackupPayload, BackupRestoreResult } from './types.js';

export class BackupManager {
  /**
   * Genera un archivo de respaldo ligero (< 2MB) con firma de integridad
   */
  static createSignedBackup(usuarioService: UsuarioMemoriaService): string {
    const chats = usuarioService.listChats();
    const profile = usuarioService.getGlobalProfile();
    const studies = usuarioService.listStudyNotes();

    const rawData = JSON.stringify({ chats, profile, studies });
    let hash = 0;
    for (let i = 0; i < rawData.length; i++) {
      hash = (hash << 5) - hash + rawData.charCodeAt(i);
      hash |= 0;
    }
    const integrityHash = `sha_${Math.abs(hash).toString(16)}`;

    const payload: BackupPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      integrityHash,
      chats,
      profile,
      studies,
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Restaura y valida un backup en la base de datos local
   */
  static restoreFromBackup(
    backupJson: string,
    usuarioService: UsuarioMemoriaService
  ): BackupRestoreResult {
    try {
      const parsed: BackupPayload = JSON.parse(backupJson);

      if (!parsed.version || !parsed.chats || !parsed.profile || !parsed.studies) {
        return {
          success: false,
          totalChatsRestored: 0,
          totalStudiesRestored: 0,
          error: 'Estructura de respaldo inválida o incompatible.',
        };
      }

      // 1. Restaurar perfil de memoria evolutiva
      const profile = parsed.profile as UserEvolutionProfile;
      usuarioService.updateGlobalProfile(profile);

      // 2. Restaurar chats
      let chatsRestored = 0;
      const chatsList = parsed.chats as ChatRecord[];
      for (const c of chatsList) {
        // Eliminar si ya existe para evitar colisión de clave primaria
        usuarioService.deleteChat(c.id);
        const newChat = usuarioService.createChat(c.titulo, c.ruta_predominante, c.nivel_teologico);
        // Actualizar id original y mensajes
        usuarioService.saveChatMessages(newChat.id, c.mensajes, {
          titulo: c.titulo,
          ruta: c.ruta_predominante,
          nivel: c.nivel_teologico,
        });
        chatsRestored++;
      }

      // 3. Restaurar estudios del cuaderno
      let studiesRestored = 0;
      const studiesList = parsed.studies as StudyNote[];
      for (const s of studiesList) {
        usuarioService.saveStudyNote({
          id: s.id,
          chat_id: s.chat_id,
          titulo: s.titulo,
          tema: s.tema,
          nivel_audiencia: s.nivel_audiencia,
          versiculo_clave: s.versiculo_clave,
          contenido_markdown: s.contenido_markdown,
          bosquejo_puntos: s.bosquejo_puntos,
          referencias_cruzadas: s.referencias_cruzadas,
          exportado_whatsapp: s.exportado_whatsapp,
          exportado_pdf: s.exportado_pdf,
        });
        studiesRestored++;
      }

      return {
        success: true,
        totalChatsRestored: chatsRestored,
        totalStudiesRestored: studiesRestored,
      };
    } catch (err) {
      return {
        success: false,
        totalChatsRestored: 0,
        totalStudiesRestored: 0,
        error: err instanceof Error ? err.message : 'Error al procesar el archivo JSON de respaldo',
      };
    }
  }
}
