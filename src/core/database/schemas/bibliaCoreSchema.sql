-- =========================================================================
-- BIBLIA CORE SCHEMA (Solo Lectura - RV1909 / VBL Dominio Público)
-- Archivo: biblia_core.sqlite
-- =========================================================================

-- Tabla de libros canónicos (66 libros)
CREATE TABLE IF NOT EXISTS libros (
  id INTEGER PRIMARY KEY,
  testamento TEXT NOT NULL CHECK(testamento IN ('AT', 'NT')),
  nombre TEXT NOT NULL UNIQUE,
  abreviatura TEXT NOT NULL UNIQUE,
  capitulos INTEGER NOT NULL
);

-- Tabla principal de versículos
CREATE TABLE IF NOT EXISTS versiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id INTEGER NOT NULL,
  libro_nombre TEXT NOT NULL,
  capitulo INTEGER NOT NULL,
  versiculo INTEGER NOT NULL,
  texto TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'RV1909',
  FOREIGN KEY (libro_id) REFERENCES libros(id),
  UNIQUE(libro_id, capitulo, versiculo, version)
);

-- Índices B-Tree para recuperación instantánea O(log N)
CREATE INDEX IF NOT EXISTS idx_versiculos_busqueda 
ON versiculos (libro_nombre, capitulo, versiculo);

CREATE INDEX IF NOT EXISTS idx_versiculos_capitulo 
ON versiculos (libro_id, capitulo);

-- Tabla de Búsqueda de Texto Completo FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS versiculos_fts USING fts5(
  libro_nombre,
  capitulo UNINDEXED,
  versiculo UNINDEXED,
  texto,
  content='versiculos',
  content_rowid='id'
);

-- Triggers de sincronización FTS5
CREATE TRIGGER IF NOT EXISTS versiculos_ai AFTER INSERT ON versiculos BEGIN
  INSERT INTO versiculos_fts(rowid, libro_nombre, capitulo, versiculo, texto)
  VALUES (new.id, new.libro_nombre, new.capitulo, new.versiculo, new.texto);
END;

CREATE TRIGGER IF NOT EXISTS versiculos_ad AFTER DELETE ON versiculos BEGIN
  INSERT INTO versiculos_fts(versiculos_fts, rowid, libro_nombre, capitulo, versiculo, texto)
  VALUES('delete', old.id, old.libro_nombre, old.capitulo, old.versiculo, old.texto);
END;

-- Tabla de Referencias Cruzadas (Treasury of Scripture Knowledge - TSK)
CREATE TABLE IF NOT EXISTS referencias_cruzadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origen_libro TEXT NOT NULL,
  origen_capitulo INTEGER NOT NULL,
  origen_versiculo INTEGER NOT NULL,
  destino_libro TEXT NOT NULL,
  destino_capitulo INTEGER NOT NULL,
  destino_versiculo INTEGER NOT NULL,
  peso INTEGER DEFAULT 1,
  tipo_relacion TEXT DEFAULT 'TSK_PARALELO'
);

CREATE INDEX IF NOT EXISTS idx_ref_origen 
ON referencias_cruzadas (origen_libro, origen_capitulo, origen_versiculo);

-- Diccionario Strong (Hebreo y Griego)
CREATE TABLE IF NOT EXISTS diccionario_strong (
  codigo TEXT PRIMARY KEY, -- ej: H1254, G26
  idioma TEXT NOT NULL CHECK(idioma IN ('HEBREO', 'GRIEGO', 'ARAMEO')),
  palabra_original TEXT NOT NULL,
  transliteracion TEXT NOT NULL,
  pronunciacion TEXT NOT NULL,
  definicion TEXT NOT NULL,
  etimologia TEXT,
  frecuencia_ocurrencia INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_strong_idioma 
ON diccionario_strong (idioma);
