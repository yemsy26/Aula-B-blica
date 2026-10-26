import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadOrInitBibliaDatabase,
  loadOrInitUsuarioDatabase,
  persistUsuarioDatabase,
  persistBibliaDatabase,
  SQLITE_BIBLIA_FILE,
  SQLITE_USUARIO_FILE,
} from '../core/database/persistenceService.js';
import { nativeBridge } from '../core/native-bridge/bridge.js';

describe('Persistencia Permanente Real en Almacenamiento Local (Anti-Pérdida en F5/Actualización)', () => {
  beforeEach(async () => {
    await nativeBridge.deletePrivateFile(SQLITE_BIBLIA_FILE);
    await nativeBridge.deletePrivateFile(SQLITE_USUARIO_FILE);
  });

  it('debe persistir chats y notas de estudio de usuario entre recargas de la aplicación', async () => {
    // 1. Primera carga: Inicialización limpia
    const init1 = await loadOrInitUsuarioDatabase();
    expect(init1.wasLoadedFromStorage).toBe(false);

    // 2. El usuario crea un chat con mensajes y una nota de estudio
    const chat = init1.service.createChat('Estudio de Romanos 8', '[CREADOR_ESTUDIO]', 'Discipulo');
    init1.service.saveChatMessages(chat.id, [
      {
        id: 'msg_1',
        role: 'user',
        content: '¿Quién nos separará del amor de Cristo?',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg_2',
        role: 'assistant',
        content: 'Romanos 8:35 nos asegura que ninguna tribulación ni angustia nos separará.',
        timestamp: new Date().toISOString(),
      },
    ]);

    init1.service.saveStudyNote({
      chat_id: chat.id,
      titulo: 'Victoria en Cristo',
      tema: 'Seguridad Eterna',
      nivel_audiencia: 'Discipulo',
      versiculo_clave: 'Romanos 8:37',
      contenido_markdown: 'Antes, en todas estas cosas somos más que vencedores...',
      bosquejo_puntos: ['1. Seguridad inquebrantable', '2. Más que vencedores'],
      referencias_cruzadas: ['Romanos 8:31-39'],
      exportado_whatsapp: false,
      exportado_pdf: false,
    });

    // 3. Persistir en almacenamiento privado
    const persisted = await persistUsuarioDatabase(init1.service);
    expect(persisted).toBe(true);

    // 4. Simulación de recarga de la página (F5 o actualización de navegador)
    const init2 = await loadOrInitUsuarioDatabase();
    expect(init2.wasLoadedFromStorage).toBe(true);

    // 5. Verificar que la información real no se perdió ni se reinició
    const restoredChats = init2.service.listChats();
    expect(restoredChats.length).toBe(1);
    expect(restoredChats[0].titulo).toBe('Estudio de Romanos 8');
    expect(restoredChats[0].mensajes.length).toBe(2);
    expect(restoredChats[0].mensajes[0].content).toContain('¿Quién nos separará');

    const restoredStudies = init2.service.listStudyNotes();
    expect(restoredStudies.length).toBe(1);
    expect(restoredStudies[0].titulo).toBe('Victoria en Cristo');
    expect(restoredStudies[0].versiculo_clave).toBe('Romanos 8:37');
  });

  it('debe persistir libros y versiones bíblicas agregadas entre recargas de la aplicación', async () => {
    // 1. Inicializar base de datos de la Biblia
    const initBiblia1 = await loadOrInitBibliaDatabase();
    expect(initBiblia1.service.listAvailableVersions()).toContain('RV1909');

    // 2. Insertar un versículo de una versión personalizada
    initBiblia1.service.getDatabaseAdapter().execute(
      `INSERT INTO versiculos (libro_id, libro_nombre, capitulo, versiculo, texto, version)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 'Génesis', 1, 1, 'En el principio Dios creó los cielos y la tierra.', 'CUSTOM_VBL']
    );

    // 3. Persistir binario en almacenamiento local privado
    const persisted = await persistBibliaDatabase(initBiblia1.service);
    expect(persisted).toBe(true);

    // 4. Simular recarga (F5)
    const initBiblia2 = await loadOrInitBibliaDatabase();
    expect(initBiblia2.wasLoadedFromStorage).toBe(true);

    // 5. Verificar que la versión y los datos siguen existiendo exactamente igual
    const versions = initBiblia2.service.listAvailableVersions();
    expect(versions).toContain('CUSTOM_VBL');

    const verses = initBiblia2.service.getVerseRange('Génesis', 1, 1, 1, 'CUSTOM_VBL');
    expect(verses.length).toBe(1);
    expect(verses[0].texto).toBe('En el principio Dios creó los cielos y la tierra.');
  });
});
