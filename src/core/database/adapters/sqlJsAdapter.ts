import type { Database, SqlJsStatic } from 'sql.js';
import { DatabaseAdapter, QueryResult } from './types.js';

let sqlJsInstance: SqlJsStatic | null = null;

export async function getSqlJs(wasmUrl: string = '/sql-wasm.wasm'): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    let initFn: any = null;

    if (typeof window !== 'undefined' && (window as any).initSqlJs) {
      initFn = (window as any).initSqlJs;
    } else {
      try {
        const sqlModule: any = await import('sql.js');
        initFn = sqlModule.default || sqlModule.initSqlJs || sqlModule;
      } catch (err) {
        if (typeof window !== 'undefined' && (window as any).initSqlJs) {
          initFn = (window as any).initSqlJs;
        } else {
          throw new Error(`No se pudo inicializar sql.js: ${err}`);
        }
      }
    }

    if (typeof initFn !== 'function') {
      throw new Error('El inicializador de sql.js no es una función ejecutable.');
    }

    if (typeof window !== 'undefined') {
      sqlJsInstance = await initFn({
        locateFile: () => wasmUrl,
      });
    } else {
      sqlJsInstance = await initFn();
    }
  }
  return sqlJsInstance!;
}

export class SqlJsDatabaseAdapter implements DatabaseAdapter {
  private db: Database;
  private fts5Available: boolean = false;

  constructor(db: Database) {
    this.db = db;
    this.checkFts5();
  }

  static async create(initialData?: Uint8Array, wasmUrl?: string): Promise<SqlJsDatabaseAdapter> {
    const SQL = await getSqlJs(wasmUrl);
    const db = initialData ? new SQL.Database(initialData) : new SQL.Database();
    return new SqlJsDatabaseAdapter(db);
  }

  private checkFts5(): void {
    try {
      this.db.run('CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(x); DROP TABLE _fts5_test;');
      this.fts5Available = true;
    } catch {
      this.fts5Available = false;
    }
  }

  isFts5Supported(): boolean {
    return this.fts5Available;
  }

  execute(sql: string, params?: unknown[]): void {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.run(params as any);
      stmt.free();
    } else {
      this.db.run(sql);
    }
  }

  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): QueryResult<T> {
    let result: { columns: string[]; values: unknown[][] }[] = [];

    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.bind(params as any);
      const columns = stmt.getColumnNames();
      const values: unknown[][] = [];
      while (stmt.step()) {
        values.push(stmt.get());
      }
      stmt.free();
      result = [{ columns, values }];
    } else {
      result = this.db.exec(sql);
    }

    if (!result || result.length === 0) {
      return { columns: [], values: [], rows: [] };
    }

    const { columns, values } = result[0];
    const rows: T[] = values.map((valRow) => {
      const rowObj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        rowObj[col] = valRow[idx];
      });
      return rowObj as T;
    });

    return { columns, values, rows };
  }

  runBatch(sqlStatements: string[]): void {
    this.db.run('BEGIN TRANSACTION;');
    try {
      for (const statement of sqlStatements) {
        if (statement.trim()) {
          this.db.run(statement);
        }
      }
      this.db.run('COMMIT;');
    } catch (error) {
      this.db.run('ROLLBACK;');
      throw error;
    }
  }

  exportBinary(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}
