import { DatabaseAdapter } from './adapters/types.js';
import {
  CANONICAL_BOOKS,
  CORE_VERSES_RV1909,
  TSK_CROSS_REFERENCES,
  STRONG_DICTIONARY,
  VerseSeed,
  CrossReferenceSeed,
  StrongSeed,
} from './seedData.js';

export interface VerseSearchResult {
  libro_nombre: string;
  capitulo: number;
  versiculo: number;
  texto: string;
  version: string;
  rank?: number;
}

export class BibliaCoreService {
  private db: DatabaseAdapter;
  private ftsType: 'fts5' | 'fts4' | 'like' = 'like';

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  /**
   * Inicializa las tablas del núcleo bíblico y carga los datos semilla RV1909
   */
  async initializeSchemaAndSeeds(): Promise<void> {
    // 1. Tablas relacionales estándar
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS libros (
        id INTEGER PRIMARY KEY,
        testamento TEXT NOT NULL CHECK(testamento IN ('AT', 'NT')),
        nombre TEXT NOT NULL UNIQUE,
        abreviatura TEXT NOT NULL UNIQUE,
        capitulos INTEGER NOT NULL
      );

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

      CREATE INDEX IF NOT EXISTS idx_versiculos_busqueda 
      ON versiculos (libro_nombre, capitulo, versiculo);

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

      CREATE TABLE IF NOT EXISTS diccionario_strong (
        codigo TEXT PRIMARY KEY,
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
    `);

    // 2. Intentar inicializar tabla FTS (FTS5 -> FTS4 -> Fallback B-Tree)
    this.setupFullTextSearch();

    // 3. Poblar semillas si la base de datos está vacía
    this.seedIfEmpty();
  }

  private setupFullTextSearch(): void {
    if (this.db.isFts5Supported()) {
      try {
        this.db.execute(`
          CREATE VIRTUAL TABLE IF NOT EXISTS versiculos_fts USING fts5(
            libro_nombre,
            capitulo UNINDEXED,
            versiculo UNINDEXED,
            texto,
            content='versiculos',
            content_rowid='id'
          );
        `);
        this.ftsType = 'fts5';
        return;
      } catch {
        // Fallback a FTS4
      }
    }

    try {
      this.db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS versiculos_fts USING fts4(
          libro_nombre,
          capitulo,
          versiculo,
          texto
        );
      `);
      this.ftsType = 'fts4';
    } catch {
      this.ftsType = 'like';
    }
  }

  private seedIfEmpty(): void {
    const countCheck = this.db.query<{ count: number }>(
      'SELECT count(*) as count FROM libros'
    );
    if (countCheck.rows.length > 0 && countCheck.rows[0].count > 0) {
      return; // Ya poblado
    }

    // 1. Libros
    for (const b of CANONICAL_BOOKS) {
      this.db.execute(
        'INSERT OR IGNORE INTO libros (id, testamento, nombre, abreviatura, capitulos) VALUES (?, ?, ?, ?, ?)',
        [b.id, b.testamento, b.nombre, b.abreviatura, b.capitulos]
      );
    }

    // 2. Versículos
    for (const v of CORE_VERSES_RV1909) {
      this.db.execute(
        'INSERT OR IGNORE INTO versiculos (libro_id, libro_nombre, capitulo, versiculo, texto, version) VALUES (?, ?, ?, ?, ?, ?)',
        [v.libro_id, v.libro_nombre, v.capitulo, v.versiculo, v.texto, v.version]
      );
      if (this.ftsType === 'fts4') {
        this.db.execute(
          'INSERT INTO versiculos_fts (libro_nombre, capitulo, versiculo, texto) VALUES (?, ?, ?, ?)',
          [v.libro_nombre, v.capitulo, v.versiculo, v.texto]
        );
      }
    }

    // 3. Referencias cruzadas
    for (const r of TSK_CROSS_REFERENCES) {
      this.db.execute(
        'INSERT INTO referencias_cruzadas (origen_libro, origen_capitulo, origen_versiculo, destino_libro, destino_capitulo, destino_versiculo, peso, tipo_relacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          r.origen_libro,
          r.origen_capitulo,
          r.origen_versiculo,
          r.destino_libro,
          r.destino_capitulo,
          r.destino_versiculo,
          r.peso,
          r.tipo_relacion,
        ]
      );
    }

    // 4. Diccionario Strong
    for (const s of STRONG_DICTIONARY) {
      this.db.execute(
        'INSERT OR IGNORE INTO diccionario_strong (codigo, idioma, palabra_original, transliteracion, pronunciacion, definicion, etimologia, frecuencia_ocurrencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          s.codigo,
          s.idioma,
          s.palabra_original,
          s.transliteracion,
          s.pronunciacion,
          s.definicion,
          s.etimologia || '',
          s.frecuencia_ocurrencia,
        ]
      );
    }
  }

  /**
   * Obtiene un versículo exacto literal O(1)
   */
  getVerse(book: string, chapter: number, verse: number, version: string = 'RV1909'): VerseSeed | null {
    const res = this.db.query<VerseSeed>(
      `SELECT libro_id, libro_nombre, capitulo, versiculo, texto, version 
       FROM versiculos 
       WHERE LOWER(libro_nombre) = LOWER(?) AND capitulo = ? AND versiculo = ? AND version = ?
       LIMIT 1`,
      [book, chapter, verse, version]
    );

    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Obtiene un rango de versículos consecutivos
   */
  getVerseRange(
    book: string,
    chapter: number,
    startVerse: number,
    endVerse: number,
    version: string = 'RV1909'
  ): VerseSeed[] {
    const res = this.db.query<VerseSeed>(
      `SELECT libro_id, libro_nombre, capitulo, versiculo, texto, version 
       FROM versiculos 
       WHERE LOWER(libro_nombre) = LOWER(?) AND capitulo = ? AND versiculo >= ? AND versiculo <= ? AND version = ?
       ORDER BY versiculo ASC`,
      [book, chapter, startVerse, endVerse, version]
    );

    return res.rows;
  }

  /**
   * Obtiene versículos representativos de un libro específico
   */
  getVersesByBook(book: string, limit: number = 6, version: string = 'RV1909'): VerseSeed[] {
    const res = this.db.query<VerseSeed>(
      `SELECT libro_id, libro_nombre, capitulo, versiculo, texto, version 
       FROM versiculos 
       WHERE LOWER(libro_nombre) = LOWER(?) AND version = ?
       ORDER BY capitulo ASC, versiculo ASC
       LIMIT ?`,
      [book, version, limit]
    );

    return res.rows;
  }

  /**
   * Búsqueda por texto completo o concordancia
   */
  searchVerses(queryText: string, limit: number = 10): VerseSearchResult[] {
    const clean = queryText.trim().replace(/['"*]/g, '');
    if (!clean) return [];

    if (this.ftsType === 'fts5') {
      try {
        const ftsRes = this.db.query<VerseSearchResult>(
          `SELECT libro_nombre, capitulo, versiculo, texto, 'RV1909' as version
           FROM versiculos_fts 
           WHERE versiculos_fts MATCH ? 
           LIMIT ?`,
          [clean, limit]
        );
        if (ftsRes.rows.length > 0) return ftsRes.rows;
      } catch {
        // Fallback a consulta relacional
      }
    } else if (this.ftsType === 'fts4') {
      try {
        const ftsRes = this.db.query<VerseSearchResult>(
          `SELECT libro_nombre, capitulo, versiculo, texto, 'RV1909' as version
           FROM versiculos_fts 
           WHERE versiculos_fts MATCH ? 
           LIMIT ?`,
          [clean, limit]
        );
        if (ftsRes.rows.length > 0) return ftsRes.rows;
      } catch {
        // Fallback a LIKE
      }
    }

    // Fallback optimizado con LIKE
    const likeRes = this.db.query<VerseSearchResult>(
      `SELECT libro_nombre, capitulo, versiculo, texto, version 
       FROM versiculos 
       WHERE texto LIKE ? 
       LIMIT ?`,
      [`%${clean}%`, limit]
    );

    return likeRes.rows;
  }

  /**
   * Obtiene referencias cruzadas TSK (Treasury of Scripture Knowledge)
   */
  getCrossReferences(book: string, chapter: number, verse: number): CrossReferenceSeed[] {
    const res = this.db.query<CrossReferenceSeed>(
      `SELECT origen_libro, origen_capitulo, origen_versiculo, destino_libro, destino_capitulo, destino_versiculo, peso, tipo_relacion
       FROM referencias_cruzadas
       WHERE LOWER(origen_libro) = LOWER(?) AND origen_capitulo = ? AND origen_versiculo = ?
       ORDER BY peso DESC`,
      [book, chapter, verse]
    );

    return res.rows;
  }

  /**
   * Obtiene la definición Strong por código (ej: H1254, G26)
   */
  getStrongEntry(code: string): StrongSeed | null {
    const normalized = code.trim().toUpperCase();
    const res = this.db.query<StrongSeed>(
      `SELECT codigo, idioma, palabra_original, transliteracion, pronunciacion, definicion, etimologia, frecuencia_ocurrencia
       FROM diccionario_strong
       WHERE UPPER(codigo) = ?
       LIMIT 1`,
      [normalized]
    );

    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Lista todas las versiones bíblicas disponibles (RV1909 por defecto + versiones importadas)
   */
  listAvailableVersions(): string[] {
    const res = this.db.query<{ version: string }>(
      'SELECT DISTINCT version FROM versiculos ORDER BY version ASC'
    );
    const versions = res.rows.map((r) => r.version);
    return versions.length > 0 ? versions : ['RV1909'];
  }

  /**
   * Importación de lotes de versículos (para extender capítulos o traducciones)
   */
  importVersesBatch(verses: VerseSeed[]): void {
    const statements: string[] = [];
    for (const v of verses) {
      const escapedText = v.texto.replace(/'/g, "''");
      statements.push(
        `INSERT OR REPLACE INTO versiculos (libro_id, libro_nombre, capitulo, versiculo, texto, version) 
         VALUES (${v.libro_id}, '${v.libro_nombre}', ${v.capitulo}, ${v.versiculo}, '${escapedText}', '${v.version}');`
      );
    }
    this.db.runBatch(statements);
  }
}
