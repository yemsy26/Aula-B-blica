import { DatabaseAdapter } from './adapters/types.js';
import { TheologicalRoute, UserTheologicalLevel } from '../shield/types.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  route?: TheologicalRoute;
  level?: UserTheologicalLevel;
  citations?: string[];
  isCrisis?: boolean;
}

export interface ChatRecord {
  id: string;
  titulo: string;
  ruta_predominante: TheologicalRoute;
  nivel_teologico: UserTheologicalLevel;
  fecha_creacion: string;
  fecha_actualizacion: string;
  mensajes: ChatMessage[];
  fijado: boolean;
  etiquetas: string[];
}

export interface UserEvolutionProfile {
  nivel_espiritual: UserTheologicalLevel;
  tono_preferido: 'pastoral_calido' | 'academico_reverente' | 'sencillo_didactico';
  temas_estudiados: { tema: string; fecha: string; count: number }[];
  dudas_pendientes: { id: string; pregunta: string; fecha: string; resuelta: boolean }[];
  resumen_madurez: string;
}

export interface StudyNote {
  id: string;
  chat_id?: string;
  titulo: string;
  tema: string;
  nivel_audiencia: UserTheologicalLevel;
  versiculo_clave?: string;
  contenido_markdown: string;
  bosquejo_puntos: string[];
  referencias_cruzadas: string[];
  fecha_creacion: string;
  fecha_actualizacion: string;
  exportado_whatsapp: boolean;
  exportado_pdf: boolean;
}

export class UsuarioMemoriaService {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  getDatabaseAdapter(): DatabaseAdapter {
    return this.db;
  }

  /**
   * Inicializa las tablas del esquema de memoria de usuario
   */
  async initializeSchema(): Promise<void> {
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        titulo TEXT NOT NULL,
        ruta_predominante TEXT NOT NULL DEFAULT '[CHARLA_CONSEJERIA]',
        nivel_teologico TEXT NOT NULL DEFAULT 'Semilla',
        fecha_creacion TEXT NOT NULL,
        fecha_actualizacion TEXT NOT NULL,
        mensajes_json TEXT NOT NULL DEFAULT '[]',
        fijado INTEGER DEFAULT 0,
        etiquetas TEXT DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_chats_actualizacion 
      ON chats (fecha_actualizacion DESC);

      CREATE TABLE IF NOT EXISTS memoria_global_evolutiva (
        clave TEXT PRIMARY KEY,
        categoria TEXT NOT NULL,
        valor_json TEXT NOT NULL,
        ultima_actualizacion TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cuaderno_estudios (
        id TEXT PRIMARY KEY,
        chat_id TEXT,
        titulo TEXT NOT NULL,
        tema TEXT NOT NULL,
        nivel_audiencia TEXT NOT NULL DEFAULT 'Semilla',
        versiculo_clave TEXT,
        contenido_markdown TEXT NOT NULL,
        bosquejo_puntos TEXT,
        referencias_cruzadas TEXT,
        fecha_creacion TEXT NOT NULL,
        fecha_actualizacion TEXT NOT NULL,
        exportado_whatsapp INTEGER DEFAULT 0,
        exportado_pdf INTEGER DEFAULT 0,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cuaderno_fecha 
      ON cuaderno_estudios (fecha_actualizacion DESC);
    `);

    // Inicializar ficha maestra si no existe
    this.initMasterProfileIfMissing();
  }

  private initMasterProfileIfMissing(): void {
    const existing = this.db.query(
      "SELECT clave FROM memoria_global_evolutiva WHERE clave = 'perfil_usuario' LIMIT 1"
    );

    if (existing.rows.length === 0) {
      const defaultProfile: UserEvolutionProfile = {
        nivel_espiritual: 'Semilla',
        tono_preferido: 'pastoral_calido',
        temas_estudiados: [],
        dudas_pendientes: [],
        resumen_madurez: 'Comenzando el viaje de discipulado con hambre espiritual.',
      };

      const now = new Date().toISOString();
      this.db.execute(
        'INSERT INTO memoria_global_evolutiva (clave, categoria, valor_json, ultima_actualizacion) VALUES (?, ?, ?, ?)',
        ['perfil_usuario', 'PERFIL', JSON.stringify(defaultProfile), now]
      );
    }
  }

  // --- GESTIÓN DE CHATS ---

  createChat(
    titulo: string,
    ruta: TheologicalRoute = '[CHARLA_CONSEJERIA]',
    nivel: UserTheologicalLevel = 'Semilla'
  ): ChatRecord {
    const id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const chat: ChatRecord = {
      id,
      titulo,
      ruta_predominante: ruta,
      nivel_teologico: nivel,
      fecha_creacion: now,
      fecha_actualizacion: now,
      mensajes: [],
      fijado: false,
      etiquetas: [],
    };

    this.db.execute(
      `INSERT INTO chats (id, titulo, ruta_predominante, nivel_teologico, fecha_creacion, fecha_actualizacion, mensajes_json, fijado, etiquetas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chat.id,
        chat.titulo,
        chat.ruta_predominante,
        chat.nivel_teologico,
        chat.fecha_creacion,
        chat.fecha_actualizacion,
        JSON.stringify(chat.mensajes),
        0,
        JSON.stringify(chat.etiquetas),
      ]
    );

    return chat;
  }

  listChats(): ChatRecord[] {
    const res = this.db.query<{
      id: string;
      titulo: string;
      ruta_predominante: string;
      nivel_teologico: string;
      fecha_creacion: string;
      fecha_actualizacion: string;
      mensajes_json: string;
      fijado: number;
      etiquetas: string;
    }>('SELECT * FROM chats ORDER BY fijado DESC, fecha_actualizacion DESC');

    return res.rows.map((row) => ({
      id: row.id,
      titulo: row.titulo,
      ruta_predominante: row.ruta_predominante as TheologicalRoute,
      nivel_teologico: row.nivel_teologico as UserTheologicalLevel,
      fecha_creacion: row.fecha_creacion,
      fecha_actualizacion: row.fecha_actualizacion,
      mensajes: JSON.parse(row.mensajes_json || '[]'),
      fijado: row.fijado === 1,
      etiquetas: JSON.parse(row.etiquetas || '[]'),
    }));
  }

  getChat(id: string): ChatRecord | null {
    const res = this.db.query<{
      id: string;
      titulo: string;
      ruta_predominante: string;
      nivel_teologico: string;
      fecha_creacion: string;
      fecha_actualizacion: string;
      mensajes_json: string;
      fijado: number;
      etiquetas: string;
    }>('SELECT * FROM chats WHERE id = ? LIMIT 1', [id]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      id: row.id,
      titulo: row.titulo,
      ruta_predominante: row.ruta_predominante as TheologicalRoute,
      nivel_teologico: row.nivel_teologico as UserTheologicalLevel,
      fecha_creacion: row.fecha_creacion,
      fecha_actualizacion: row.fecha_actualizacion,
      mensajes: JSON.parse(row.mensajes_json || '[]'),
      fijado: row.fijado === 1,
      etiquetas: JSON.parse(row.etiquetas || '[]'),
    };
  }

  saveChatMessages(
    chatId: string,
    mensajes: ChatMessage[],
    updateMeta?: { titulo?: string; ruta?: TheologicalRoute; nivel?: UserTheologicalLevel }
  ): void {
    const now = new Date().toISOString();
    const chat = this.getChat(chatId);
    if (!chat) return;

    const titulo = updateMeta?.titulo || chat.titulo;
    const ruta = updateMeta?.ruta || chat.ruta_predominante;
    const nivel = updateMeta?.nivel || chat.nivel_teologico;

    this.db.execute(
      `UPDATE chats 
       SET mensajes_json = ?, fecha_actualizacion = ?, titulo = ?, ruta_predominante = ?, nivel_teologico = ?
       WHERE id = ?`,
      [JSON.stringify(mensajes), now, titulo, ruta, nivel, chatId]
    );
  }

  deleteChat(chatId: string): void {
    this.db.execute('DELETE FROM chats WHERE id = ?', [chatId]);
  }

  togglePinChat(chatId: string): boolean {
    const chat = this.getChat(chatId);
    if (!chat) return false;
    const newStatus = chat.fijado ? 0 : 1;
    this.db.execute('UPDATE chats SET fijado = ? WHERE id = ?', [newStatus, chatId]);
    return newStatus === 1;
  }

  // --- MEMORIA GLOBAL EVOLUTIVA ---

  getGlobalProfile(): UserEvolutionProfile {
    const res = this.db.query<{ valor_json: string }>(
      "SELECT valor_json FROM memoria_global_evolutiva WHERE clave = 'perfil_usuario' LIMIT 1"
    );

    if (res.rows.length === 0) {
      this.initMasterProfileIfMissing();
      return this.getGlobalProfile();
    }

    return JSON.parse(res.rows[0].valor_json);
  }

  updateGlobalProfile(updates: Partial<UserEvolutionProfile>): UserEvolutionProfile {
    const current = this.getGlobalProfile();
    const updated: UserEvolutionProfile = { ...current, ...updates };
    const now = new Date().toISOString();

    this.db.execute(
      `INSERT OR REPLACE INTO memoria_global_evolutiva (clave, categoria, valor_json, ultima_actualizacion) 
       VALUES ('perfil_usuario', 'PERFIL', ?, ?)`,
      [JSON.stringify(updated), now]
    );

    return updated;
  }

  recordTopicLearned(topic: string): void {
    const profile = this.getGlobalProfile();
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    const existingIdx = profile.temas_estudiados.findIndex(
      (t) => t.tema.toLowerCase() === cleanTopic.toLowerCase()
    );

    const now = new Date().toISOString();
    if (existingIdx >= 0) {
      profile.temas_estudiados[existingIdx].count += 1;
      profile.temas_estudiados[existingIdx].fecha = now;
    } else {
      profile.temas_estudiados.push({
        tema: cleanTopic,
        fecha: now,
        count: 1,
      });
    }

    this.updateGlobalProfile({ temas_estudiados: profile.temas_estudiados });
  }

  addPendingQuestion(pregunta: string): void {
    const profile = this.getGlobalProfile();
    const id = `duda_${Date.now()}`;
    profile.dudas_pendientes.push({
      id,
      pregunta: pregunta.trim(),
      fecha: new Date().toISOString(),
      resuelta: false,
    });
    this.updateGlobalProfile({ dudas_pendientes: profile.dudas_pendientes });
  }

  // --- CUADERNO DE ESTUDIOS ---

  saveStudyNote(
    note: Omit<StudyNote, 'fecha_creacion' | 'fecha_actualizacion' | 'id'> & { id?: string }
  ): StudyNote {
    const id = note.id || `estudio_${Date.now()}`;
    const now = new Date().toISOString();

    const existing = this.getStudyNote(id);
    const fecha_creacion = existing ? existing.fecha_creacion : now;

    const fullNote: StudyNote = {
      ...note,
      id,
      fecha_creacion,
      fecha_actualizacion: now,
    };

    this.db.execute(
      `INSERT OR REPLACE INTO cuaderno_estudios 
       (id, chat_id, titulo, tema, nivel_audiencia, versiculo_clave, contenido_markdown, bosquejo_puntos, referencias_cruzadas, fecha_creacion, fecha_actualizacion, exportado_whatsapp, exportado_pdf)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fullNote.id,
        fullNote.chat_id || null,
        fullNote.titulo,
        fullNote.tema,
        fullNote.nivel_audiencia,
        fullNote.versiculo_clave || '',
        fullNote.contenido_markdown,
        JSON.stringify(fullNote.bosquejo_puntos || []),
        JSON.stringify(fullNote.referencias_cruzadas || []),
        fullNote.fecha_creacion,
        fullNote.fecha_actualizacion,
        fullNote.exportado_whatsapp ? 1 : 0,
        fullNote.exportado_pdf ? 1 : 0,
      ]
    );

    return fullNote;
  }

  listStudyNotes(): StudyNote[] {
    const res = this.db.query<{
      id: string;
      chat_id: string | null;
      titulo: string;
      tema: string;
      nivel_audiencia: string;
      versiculo_clave: string;
      contenido_markdown: string;
      bosquejo_puntos: string;
      referencias_cruzadas: string;
      fecha_creacion: string;
      fecha_actualizacion: string;
      exportado_whatsapp: number;
      exportado_pdf: number;
    }>('SELECT * FROM cuaderno_estudios ORDER BY fecha_actualizacion DESC');

    return res.rows.map((row) => ({
      id: row.id,
      chat_id: row.chat_id || undefined,
      titulo: row.titulo,
      tema: row.tema,
      nivel_audiencia: row.nivel_audiencia as UserTheologicalLevel,
      versiculo_clave: row.versiculo_clave || undefined,
      contenido_markdown: row.contenido_markdown,
      bosquejo_puntos: JSON.parse(row.bosquejo_puntos || '[]'),
      referencias_cruzadas: JSON.parse(row.referencias_cruzadas || '[]'),
      fecha_creacion: row.fecha_creacion,
      fecha_actualizacion: row.fecha_actualizacion,
      exportado_whatsapp: row.exportado_whatsapp === 1,
      exportado_pdf: row.exportado_pdf === 1,
    }));
  }

  getStudyNote(id: string): StudyNote | null {
    const res = this.db.query<{
      id: string;
      chat_id: string | null;
      titulo: string;
      tema: string;
      nivel_audiencia: string;
      versiculo_clave: string;
      contenido_markdown: string;
      bosquejo_puntos: string;
      referencias_cruzadas: string;
      fecha_creacion: string;
      fecha_actualizacion: string;
      exportado_whatsapp: number;
      exportado_pdf: number;
    }>('SELECT * FROM cuaderno_estudios WHERE id = ? LIMIT 1', [id]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      id: row.id,
      chat_id: row.chat_id || undefined,
      titulo: row.titulo,
      tema: row.tema,
      nivel_audiencia: row.nivel_audiencia as UserTheologicalLevel,
      versiculo_clave: row.versiculo_clave || undefined,
      contenido_markdown: row.contenido_markdown,
      bosquejo_puntos: JSON.parse(row.bosquejo_puntos || '[]'),
      referencias_cruzadas: JSON.parse(row.referencias_cruzadas || '[]'),
      fecha_creacion: row.fecha_creacion,
      fecha_actualizacion: row.fecha_actualizacion,
      exportado_whatsapp: row.exportado_whatsapp === 1,
      exportado_pdf: row.exportado_pdf === 1,
    };
  }

  deleteStudyNote(id: string): void {
    this.db.execute('DELETE FROM cuaderno_estudios WHERE id = ?', [id]);
  }

  /**
   * Exporta todo el estado de usuario a un blob o string JSON para backup liviano (< 2MB)
   */
  exportUserBackup(): string {
    const chats = this.listChats();
    const profile = this.getGlobalProfile();
    const studies = this.listStudyNotes();

    return JSON.stringify(
      {
        version: '1.0',
        exported_at: new Date().toISOString(),
        chats,
        profile,
        studies,
      },
      null,
      2
    );
  }
}
