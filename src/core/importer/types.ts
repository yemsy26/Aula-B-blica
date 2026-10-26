export interface BibleImportRawRecord {
  libro: string;
  capitulo: number;
  versiculo: number;
  texto: string;
  version?: string;
}

export interface BibleImportResult {
  versionTag: string;
  totalVersesImported: number;
  errors: string[];
  executionTimeMs: number;
}
