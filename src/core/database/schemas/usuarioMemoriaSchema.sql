-- =========================================================================
-- USUARIO MEMORIA SCHEMA (Lectura/Escritura - Backup Liviano < 2MB)
-- Archivo: usuario_memoria.sqlite
-- =========================================================================

-- Tabla de conversaciones múltiples
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY, -- UUID v4
  titulo TEXT NOT NULL,
  ruta_predominante TEXT NOT NULL DEFAULT '[CHARLA_CONSEJERIA]',
  nivel_teologico TEXT NOT NULL DEFAULT 'Semilla',
  fecha_creacion TEXT NOT NULL,
  fecha_actualizacion TEXT NOT NULL,
  mensajes_json TEXT NOT NULL DEFAULT '[]', -- Array serializado de mensajes
  fijado INTEGER DEFAULT 0,
  etiquetas TEXT DEFAULT '[]' -- JSON array
);

CREATE INDEX IF NOT EXISTS idx_chats_actualizacion 
ON chats (fecha_actualizacion DESC);

-- Ficha maestra del usuario que cruza todos los chats (Memoria Global Evolutiva)
CREATE TABLE IF NOT EXISTS memoria_global_evolutiva (
  clave TEXT PRIMARY KEY, -- ej: 'perfil_usuario', 'temas_estudiados', 'dudas_pendientes', 'preferencias_tono'
  categoria TEXT NOT NULL, -- 'PERFIL', 'HISTORIAL_TEMATICO', 'DUDAS', 'TONO', 'METRICAS'
  valor_json TEXT NOT NULL,
  ultima_actualizacion TEXT NOT NULL
);

-- Tabla de Cuaderno de Estudios fijados (Listos para exportar a Markdown/PDF/WhatsApp)
CREATE TABLE IF NOT EXISTS cuaderno_estudios (
  id TEXT PRIMARY KEY,
  chat_id TEXT,
  titulo TEXT NOT NULL,
  tema TEXT NOT NULL,
  nivel_audiencia TEXT NOT NULL DEFAULT 'Semilla',
  versiculo_clave TEXT,
  contenido_markdown TEXT NOT NULL,
  bosquejo_puntos TEXT, -- JSON array de puntos
  referencias_cruzadas TEXT, -- JSON array de citas
  fecha_creacion TEXT NOT NULL,
  fecha_actualizacion TEXT NOT NULL,
  exportado_whatsapp INTEGER DEFAULT 0,
  exportado_pdf INTEGER DEFAULT 0,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cuaderno_fecha 
ON cuaderno_estudios (fecha_actualizacion DESC);
