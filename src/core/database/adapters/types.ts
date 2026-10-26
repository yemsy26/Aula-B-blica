export interface QueryResult<T = Record<string, unknown>> {
  columns: string[];
  values: unknown[][];
  rows: T[];
}

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): void;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): QueryResult<T>;
  runBatch(sqlStatements: string[]): void;
  exportBinary(): Uint8Array;
  close(): void;
  isFts5Supported(): boolean;
}
