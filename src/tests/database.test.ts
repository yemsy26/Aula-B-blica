import { describe, it, expect, beforeEach } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import { UsuarioMemoriaService } from '../core/database/usuarioMemoriaService.js';

describe('Base de Datos Local Inmutable - biblia_core.sqlite', () => {
  let bibliaService: BibliaCoreService;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
  });

  it('debe recuperar un versículo exacto literal en RV1909 (Juan 3:16)', () => {
    const verse = bibliaService.getVerse('Juan', 3, 16);
    expect(verse).not.toBeNull();
    expect(verse?.libro_nombre).toBe('Juan');
    expect(verse?.capitulo).toBe(3);
    expect(verse?.versiculo).toBe(16);
    expect(verse?.texto).toContain('Porque de tal manera amó Dios al mundo');
  });

  it('debe recuperar un rango consecutivo de versículos (Génesis 1:1-3)', () => {
    const range = bibliaService.getVerseRange('Génesis', 1, 1, 3);
    expect(range).toHaveLength(3);
    expect(range[0].texto).toContain('EN el principio crió Dios');
    expect(range[2].texto).toContain('Sea la luz: y fué la luz');
  });

  it('debe realizar búsquedas por concordancia textual', () => {
    const results = bibliaService.searchVerses('pastor');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.libro_nombre === 'Salmos' && r.capitulo === 23)).toBe(true);
  });

  it('debe conectar Antiguo y Nuevo Testamento mediante referencias cruzadas TSK', () => {
    const refs = bibliaService.getCrossReferences('Génesis', 1, 1);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.some((r) => r.destino_libro === 'Juan' && r.destino_capitulo === 1)).toBe(true);
  });

  it('debe consultar entradas del Diccionario Strong (Hebreo H1254 y Griego G26)', () => {
    const bara = bibliaService.getStrongEntry('H1254');
    expect(bara).not.toBeNull();
    expect(bara?.palabra_original).toBe('בָּרָא');
    expect(bara?.definicion).toContain('Crear');

    const agape = bibliaService.getStrongEntry('G26');
    expect(agape).not.toBeNull();
    expect(agape?.transliteracion).toBe('agápē');
    expect(agape?.definicion).toContain('Amor');
  });
});

describe('Base de Datos de Memoria Global - usuario_memoria.sqlite', () => {
  let usuarioService: UsuarioMemoriaService;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    usuarioService = new UsuarioMemoriaService(adapter);
    await usuarioService.initializeSchema();
  });

  it('debe gestionar ciclo de vida de chats (crear, listar, fijar, eliminar)', () => {
    const chat = usuarioService.createChat('Consulta sobre la Gracia', '[CHARLA_CONSEJERIA]', 'Discipulo');
    expect(chat.id).toBeDefined();

    let chats = usuarioService.listChats();
    expect(chats).toHaveLength(1);
    expect(chats[0].titulo).toBe('Consulta sobre la Gracia');

    // Fijar chat
    const pinned = usuarioService.togglePinChat(chat.id);
    expect(pinned).toBe(true);

    // Eliminar chat
    usuarioService.deleteChat(chat.id);
    chats = usuarioService.listChats();
    expect(chats).toHaveLength(0);
  });

  it('debe actualizar la Ficha Maestra de Memoria Global Evolutiva', () => {
    const profile = usuarioService.getGlobalProfile();
    expect(profile.nivel_espiritual).toBe('Semilla');

    usuarioService.updateGlobalProfile({ nivel_espiritual: 'Maestro' });
    usuarioService.recordTopicLearned('Exegesis de Pactos');
    usuarioService.addPendingQuestion('¿Diferencia entre Hades y Gehena?');

    const updated = usuarioService.getGlobalProfile();
    expect(updated.nivel_espiritual).toBe('Maestro');
    expect(updated.temas_estudiados).toHaveLength(1);
    expect(updated.temas_estudiados[0].tema).toBe('Exegesis de Pactos');
    expect(updated.dudas_pendientes).toHaveLength(1);
  });

  it('debe persistir estudios en el cuaderno para exportación', () => {
    const study = usuarioService.saveStudyNote({
      titulo: 'Sermón: El Dios Creador',
      tema: 'Creación y Soberanía',
      nivel_audiencia: 'Semilla',
      versiculo_clave: 'Génesis 1:1',
      contenido_markdown: '# El Dios Creador\n\nDios creó todo de la nada...',
      bosquejo_puntos: ['1. El Principio', '2. El Poder de la Palabra'],
      referencias_cruzadas: ['Juan 1:1-3'],
      exportado_whatsapp: false,
      exportado_pdf: false,
    });

    expect(study.id).toBeDefined();

    const notes = usuarioService.listStudyNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0].titulo).toBe('Sermón: El Dios Creador');
  });

  it('debe generar un backup JSON liviano (< 2MB)', () => {
    const backupJson = usuarioService.exportUserBackup();
    expect(backupJson).toContain('version');
    expect(backupJson).toContain('profile');
    // Verificar que sea extremadamente liviano (< 2MB)
    const sizeInBytes = new TextEncoder().encode(backupJson).length;
    expect(sizeInBytes).toBeLessThan(2 * 1024 * 1024);
  });
});
