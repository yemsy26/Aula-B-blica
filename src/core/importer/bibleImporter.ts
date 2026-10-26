import { BibliaCoreService } from '../database/bibliaCoreService.js';
import { CANONICAL_BOOKS, VerseSeed } from '../database/seedData.js';
import { normalizeLinguisticDialect } from '../shield/normalizer.js';
import { BibleImportRawRecord, BibleImportResult } from './types.js';

export class BibleImporter {
  /**
   * Parsea archivos JSON (tanto formato plano como árbol anidado)
   */
  static parseJson(content: string, fallbackVersion: string = 'IMPORTADA'): BibleImportRawRecord[] {
    const records: BibleImportRawRecord[] = [];
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.libro && item.capitulo !== undefined && item.versiculo !== undefined && item.texto) {
          records.push({
            libro: String(item.libro).trim(),
            capitulo: Number(item.capitulo),
            versiculo: Number(item.versiculo),
            texto: String(item.texto).trim(),
            version: item.version ? String(item.version).trim().toUpperCase() : fallbackVersion,
          });
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Formato anidado: { "Juan": { "3": { "16": "Porque de tal manera..." } } }
      for (const [libroKey, caps] of Object.entries(parsed)) {
        if (typeof caps === 'object' && caps !== null) {
          for (const [capKey, verses] of Object.entries(caps as Record<string, unknown>)) {
            if (typeof verses === 'object' && verses !== null) {
              for (const [vKey, textVal] of Object.entries(verses as Record<string, unknown>)) {
                if (typeof textVal === 'string') {
                  records.push({
                    libro: libroKey.trim(),
                    capitulo: parseInt(capKey, 10),
                    versiculo: parseInt(vKey, 10),
                    texto: textVal.trim(),
                    version: fallbackVersion,
                  });
                }
              }
            }
          }
        }
      }
    }

    return records;
  }

  /**
   * Parsea archivos CSV delimitados por comas o punto y coma
   */
  static parseCsv(content: string, fallbackVersion: string = 'IMPORTADA'): BibleImportRawRecord[] {
    const records: BibleImportRawRecord[] = [];
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');

    if (lines.length === 0) return records;

    // Detectar si la primera línea es cabecera
    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase();
    if (
      firstLineLower.includes('libro') ||
      firstLineLower.includes('book') ||
      firstLineLower.includes('capitulo')
    ) {
      startIndex = 1;
    }

    // Detectar delimitador (coma o punto y coma)
    const delimiter = lines[0].includes(';') ? ';' : ',';

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split respetando comillas
      const parts = line.split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());

      if (parts.length >= 4) {
        const libro = parts[0];
        const capitulo = parseInt(parts[1], 10);
        const versiculo = parseInt(parts[2], 10);
        const texto = parts.slice(3).join(delimiter).replace(/^["']|["']$/g, '').trim();

        if (libro && !isNaN(capitulo) && !isNaN(versiculo) && texto) {
          records.push({
            libro,
            capitulo,
            versiculo,
            texto,
            version: fallbackVersion,
          });
        }
      }
    }

    return records;
  }

  /**
   * Inyecta la traducción externa dentro de biblia_core.sqlite y actualiza FTS
   */
  static async importBibleVersion(
    records: BibleImportRawRecord[],
    versionTag: string,
    bibliaService: BibliaCoreService
  ): Promise<BibleImportResult> {
    const startTime = performance.now();
    const cleanTag = versionTag.trim().toUpperCase() || 'CUSTOM';
    const errors: string[] = [];
    const validVerses: VerseSeed[] = [];

    // 1. Validar y resolver libros contra el canon bíblico
    for (const rec of records) {
      const normalizedBook = normalizeLinguisticDialect(rec.libro);
      const canonicalMatch = CANONICAL_BOOKS.find(
        (b) =>
          b.nombre.toLowerCase() === normalizedBook.toLowerCase() ||
          b.abreviatura.toLowerCase() === normalizedBook.toLowerCase()
      );

      const libro_id = canonicalMatch ? canonicalMatch.id : 99; // Fallback canónico
      const libro_nombre = canonicalMatch ? canonicalMatch.nombre : normalizedBook;

      validVerses.push({
        libro_id,
        libro_nombre,
        capitulo: rec.capitulo,
        versiculo: rec.versiculo,
        texto: rec.texto,
        version: cleanTag,
      });
    }

    if (validVerses.length === 0) {
      errors.push('No se encontraron registros de versículos válidos para importar.');
      return {
        versionTag: cleanTag,
        totalVersesImported: 0,
        errors,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }

    // 2. Inserción por lotes en SQLite
    bibliaService.importVersesBatch(validVerses);

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      versionTag: cleanTag,
      totalVersesImported: validVerses.length,
      errors,
      executionTimeMs,
    };
  }
}
