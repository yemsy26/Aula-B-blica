import { nativeBridge } from '../native-bridge/bridge.js';
import { BibliaCoreService } from './bibliaCoreService.js';
import { UsuarioMemoriaService } from './usuarioMemoriaService.js';
import { SqlJsDatabaseAdapter } from './adapters/sqlJsAdapter.js';

export const SQLITE_BIBLIA_FILE = 'biblia_core.sqlite';
export const SQLITE_USUARIO_FILE = 'usuario_memoria.sqlite';

/**
 * Carga o inicializa con persistencia local permanente la base de datos de la Biblia
 */
export async function loadOrInitBibliaDatabase(): Promise<{
  adapter: SqlJsDatabaseAdapter;
  service: BibliaCoreService;
  wasLoadedFromStorage: boolean;
}> {
  const binaryData = await nativeBridge.readPrivateFile(SQLITE_BIBLIA_FILE);
  let adapter: SqlJsDatabaseAdapter;

  if (binaryData && binaryData.length > 0) {
    try {
      adapter = await SqlJsDatabaseAdapter.create(binaryData);
      const service = new BibliaCoreService(adapter);
      // Aplica migraciones idempotentes (nuevas tablas, FTS y semillas faltantes).
      await service.initializeSchemaAndSeeds();
      await persistBibliaDatabase(service);
      return { adapter, service, wasLoadedFromStorage: true };
    } catch (err) {
      console.warn('Error cargando biblia_core.sqlite desde almacenamiento persistente, recreando:', err);
    }
  }

  adapter = await SqlJsDatabaseAdapter.create();
  const service = new BibliaCoreService(adapter);
  await service.initializeSchemaAndSeeds();
  await persistBibliaDatabase(service);
  return { adapter, service, wasLoadedFromStorage: false };
}

/**
 * Carga o inicializa con persistencia local permanente la base de datos de memoria del usuario
 */
export async function loadOrInitUsuarioDatabase(): Promise<{
  adapter: SqlJsDatabaseAdapter;
  service: UsuarioMemoriaService;
  wasLoadedFromStorage: boolean;
}> {
  const binaryData = await nativeBridge.readPrivateFile(SQLITE_USUARIO_FILE);
  let adapter: SqlJsDatabaseAdapter;

  if (binaryData && binaryData.length > 0) {
    try {
      adapter = await SqlJsDatabaseAdapter.create(binaryData);
      const service = new UsuarioMemoriaService(adapter);
      // Crea tablas nuevas (p. ej. dialogue_states) en bases ya existentes.
      await service.initializeSchema();
      await persistUsuarioDatabase(service);
      return { adapter, service, wasLoadedFromStorage: true };
    } catch (err) {
      console.warn('Error cargando usuario_memoria.sqlite desde almacenamiento persistente, recreando:', err);
    }
  }

  adapter = await SqlJsDatabaseAdapter.create();
  const service = new UsuarioMemoriaService(adapter);
  await service.initializeSchema();
  await persistUsuarioDatabase(service);
  return { adapter, service, wasLoadedFromStorage: false };
}

/**
 * Guarda en almacenamiento permanente el estado binario completo de la memoria de usuario
 */
export async function persistUsuarioDatabase(service: UsuarioMemoriaService): Promise<boolean> {
  try {
    const binary = service.getDatabaseAdapter().exportBinary();
    return await nativeBridge.writePrivateFile(SQLITE_USUARIO_FILE, binary);
  } catch (err) {
    console.error('Error al persistir usuario_memoria.sqlite:', err);
    return false;
  }
}

/**
 * Guarda en almacenamiento permanente el estado binario completo de la base de datos de la Biblia
 */
export async function persistBibliaDatabase(service: BibliaCoreService): Promise<boolean> {
  try {
    const binary = service.getDatabaseAdapter().exportBinary();
    return await nativeBridge.writePrivateFile(SQLITE_BIBLIA_FILE, binary);
  } catch (err) {
    console.error('Error al persistir biblia_core.sqlite:', err);
    return false;
  }
}
