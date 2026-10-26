import { describe, it, expect, beforeEach } from 'vitest';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import { UsuarioMemoriaService } from '../core/database/usuarioMemoriaService.js';
import { CitationInjector } from '../core/database/citationInjector.js';
import {
  offlineTts,
  scoreVoice,
  rankVoices,
  ProsodyChunker,
  piperNeuralTts,
} from '../core/tts/index.js';
import { BibleImporter } from '../core/importer/bibleImporter.js';
import {
  ONE_CLICK_BIBLE_CATALOG,
  downloadAndInstallModule,
  requiresLegalConsent,
  LEGAL_DISCLAIMER_TEXT,
} from '../core/importer/oneClickCatalog.js';
import { DailyBreadEngine } from '../core/retention/dailyBreadEngine.js';
import { BackupManager } from '../core/retention/backupManager.js';

describe('Motor de Voz Offline (TTS) y Limpiador Fonético', () => {
  it('debe expandir etiquetas [CITA: ...] en lenguaje hablado natural', () => {
    const raw = 'Mira lo que dice la Escritura: [CITA: Juan 3:16]. Dios te bendiga.';
    const speech = offlineTts.cleanTextForSpeech(raw);

    expect(speech).toContain('Juan, capítulo 3, versículo 16');
    expect(speech).not.toContain('[CITA:');
  });

  it('debe expandir rangos de versículos para locución fluida', () => {
    const raw = 'Lee con atención [CITA: Salmos 23:1-4] para encontrar reposo.';
    const speech = offlineTts.cleanTextForSpeech(raw);

    expect(speech).toContain('Salmos, capítulo 23, versículos del 1 al 4');
  });

  it('debe expandir abreviaturas bíblicas comunes y limpiar markdown', () => {
    const raw = '### Estudio en Gn 1:1\n> **«En el principio»** — *RV1909*';
    const speech = offlineTts.cleanTextForSpeech(raw);

    expect(speech).toContain('Génesis, capítulo 1, versículo 1');
    expect(speech).toContain('Reina Valera 1909');
    expect(speech).not.toContain('###');
    expect(speech).not.toContain('**');
    expect(speech).not.toContain('«');
  });

  it('debe rankear voces Neurales HD por encima de voces estándar', () => {
    const neuralVoice = {
      name: 'Microsoft Sabina Online (Natural) - Spanish (Mexico)',
      lang: 'es-MX',
      localService: true,
    };
    const standardVoice = { name: 'Voz estándar', lang: 'es-ES', localService: false };
    const englishVoice = { name: 'David', lang: 'en-US', localService: true };

    expect(scoreVoice(neuralVoice)).toBeGreaterThan(scoreVoice(standardVoice));
    expect(scoreVoice(standardVoice)).toBeGreaterThan(scoreVoice(englishVoice));
    expect(scoreVoice(englishVoice)).toBe(0);

    const ranked = rankVoices([
      { voiceIndex: 0, ...standardVoice, isDefault: false, isLocalService: false },
      { voiceIndex: 1, ...neuralVoice, isDefault: true, isLocalService: true },
    ]);
    expect(ranked[0].name).toContain('Sabina');
    expect(ranked[0].tier).toBe('TIER_1_NEURAL');
  });

  it('debe pronunciar reverentemente libros numerados (Primera de Juan, Segunda de Corintios) y raíces hebreas', () => {
    const input =
      'Como enseña 1 Juan 1:9 y 2 Corintios 5:17, Dios en su shalom y khesed nos renueva con su agape.';
    const speech = offlineTts.cleanTextForSpeech(input);

    expect(speech).toContain('Primera de Juan, capítulo 1, versículo 9');
    expect(speech).toContain('Segunda de Corintios, capítulo 5, versículo 17');
    expect(speech).toContain('Shalóm');
    expect(speech).toContain('Jésed');
    expect(speech).toContain('Agápe');
  });

  it('debe segmentar texto con modulación prosódica diferenciada para versículos y narrativa', () => {
    const rawStudy = `### La Promesa en la Aflicción\nEl apóstol nos consuela:\n> **«En el mundo tendréis aflicción; pero confiad, yo he vencido al mundo.»** — *Juan 16:33*\nDescansa en esta verdad cada mañana.`;
    const chunks = ProsodyChunker.chunk(rawStudy);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const titleChunk = chunks.find((c) => c.kind === 'title');
    const verseChunk = chunks.find((c) => c.kind === 'verse');
    const narrativeChunk = chunks.find((c) => c.kind === 'narrative');

    expect(titleChunk).toBeDefined();
    expect(verseChunk).toBeDefined();
    expect(narrativeChunk).toBeDefined();

    // Modulación solemne para la Escritura
    expect(verseChunk?.rate).toBeLessThan(narrativeChunk?.rate || 1);
    expect(verseChunk?.pitch).toBeLessThan(narrativeChunk?.pitch || 1);
    expect(verseChunk?.pauseAfterMs).toBeGreaterThanOrEqual(400);
  });

  it('debe listar modelos Piper Neural HD y permitir descarga fraccionada simulada', async () => {
    const models = piperNeuralTts.getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].sizeMb).toBe(35);

    let lastProgress = 0;
    const success = await piperNeuralTts.downloadAndLoad(models[0].id, (p) => {
      lastProgress = p;
    });
    expect(success).toBe(true);
    expect(lastProgress).toBe(100);
    expect(piperNeuralTts.isModelLoaded()).toBe(true);
  });
});

describe('Blindaje Legal: Importador Universal de Versiones (BYOB)', () => {
  let bibliaService: BibliaCoreService;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
  });

  it('debe parsear e importar versículos desde formato CSV', async () => {
    const csvData = `Libro,Capitulo,Versiculo,Texto
Juan,3,16,"Porque de tal manera amó Dios al mundo que dio a su Hijo unigénito..."
Salmos,23,1,"El Señor es mi pastor, nada me faltará."`;

    const records = BibleImporter.parseCsv(csvData, 'NVI');
    expect(records).toHaveLength(2);
    expect(records[0].libro).toBe('Juan');

    const result = await BibleImporter.importBibleVersion(records, 'NVI', bibliaService);
    expect(result.totalVersesImported).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Comprobar que NVI esté en las versiones disponibles
    const versions = bibliaService.listAvailableVersions();
    expect(versions).toContain('NVI');

    // Comprobar que el versículo importado se pueda recuperar
    const verseNvi = bibliaService.getVerse('Juan', 3, 16, 'NVI');
    expect(verseNvi).not.toBeNull();
    expect(verseNvi?.version).toBe('NVI');
    expect(verseNvi?.texto).toContain('amó Dios');

    const salmoNvi = bibliaService.getVerse('Salmos', 23, 1, 'NVI');
    expect(salmoNvi).not.toBeNull();
    expect(salmoNvi?.texto).toContain('El Señor es mi pastor');
  });

  it('debe parsear e importar versículos desde formato JSON anidado o plano', async () => {
    const jsonData = JSON.stringify([
      {
        libro: 'Génesis',
        capitulo: 1,
        versiculo: 1,
        texto: 'En el principio creó Dios los cielos y la tierra.',
        version: 'RVR60',
      },
    ]);

    const records = BibleImporter.parseJson(jsonData, 'RVR60');
    expect(records).toHaveLength(1);

    const result = await BibleImporter.importBibleVersion(records, 'RVR60', bibliaService);
    expect(result.totalVersesImported).toBe(1);

    const verseRvr60 = bibliaService.getVerse('Génesis', 1, 1, 'RVR60');
    expect(verseRvr60).not.toBeNull();
    expect(verseRvr60?.version).toBe('RVR60');
    expect(verseRvr60?.texto).toBe('En el principio creó Dios los cielos y la tierra.');
  });
});

describe('Motor Proactivo Pan Diario con Memoria Evolutiva', () => {
  let bibliaService: BibliaCoreService;
  let usuarioService: UsuarioMemoriaService;

  beforeEach(async () => {
    const bAdapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(bAdapter);
    await bibliaService.initializeSchemaAndSeeds();

    const uAdapter = await SqlJsDatabaseAdapter.create();
    usuarioService = new UsuarioMemoriaService(uAdapter);
    await usuarioService.initializeSchema();
  });

  it('debe personalizar el Pan Diario según los temas estudiados por el usuario', () => {
    // Simular que el usuario ha estado estudiando sobre Gracia y Perdón
    usuarioService.recordTopicLearned('Doctrina de la Gracia y Perdon');

    const daily = DailyBreadEngine.generateDailyBread(usuarioService, bibliaService, 'RV1909');

    expect(daily.temaRelacionado).toContain('Gracia');
    expect(daily.versiculoReferencia).toBe('Efesios 2:8');
    expect(daily.versiculoTexto).toContain('Porque por gracia sois salvos');
    expect(daily.reflexionPastoral.length).toBeGreaterThan(20);
    expect(daily.preguntaDelDia).toContain('?');
  });

  it('debe proveer Salmos o Isaías de consuelo si el tema estudiado fue ansiedad o miedo', () => {
    usuarioService.recordTopicLearned('Superar la ansiedad y el miedo');

    const daily = DailyBreadEngine.generateDailyBread(usuarioService, bibliaService, 'RV1909');
    expect(daily.versiculoReferencia.startsWith('Isaías') || daily.versiculoReferencia.startsWith('Salmos')).toBe(true);
  });
});

describe('Gestor de Backup Ligero y Restauración Completa', () => {
  let usuarioService: UsuarioMemoriaService;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    usuarioService = new UsuarioMemoriaService(adapter);
    await usuarioService.initializeSchema();
  });

  it('debe completar el ciclo de exportación firmada y restauración total sin pérdida de datos', () => {
    // 1. Crear datos en la base original
    const chat = usuarioService.createChat('Chat de Prueba para Backup', '[CHARLA_CONSEJERIA]', 'Discipulo');
    usuarioService.saveChatMessages(chat.id, [
      {
        id: 'msg_1',
        role: 'user',
        content: '¿Cuál es el significado de la fe?',
        timestamp: new Date().toISOString(),
      },
    ]);

    usuarioService.saveStudyNote({
      titulo: 'Estudio de Salvación',
      tema: 'Soteriología',
      nivel_audiencia: 'Discipulo',
      versiculo_clave: 'Juan 3:16',
      contenido_markdown: '# Salvación\nPor fe.',
      bosquejo_puntos: ['Punto 1'],
      referencias_cruzadas: ['Romanos 8:28'],
      exportado_whatsapp: false,
      exportado_pdf: false,
    });

    usuarioService.updateGlobalProfile({ nivel_espiritual: 'Maestro' });

    // 2. Generar Backup Firmado
    const signedJson = BackupManager.createSignedBackup(usuarioService);
    expect(signedJson).toContain('integrityHash');
    expect(signedJson).toContain('Chat de Prueba para Backup');

    // 3. Simular borrado de datos (o nueva instalación en otro teléfono)
    usuarioService.deleteChat(chat.id);
    expect(usuarioService.listChats()).toHaveLength(0);

    // 4. Restaurar desde el archivo de respaldo
    const restoreResult = BackupManager.restoreFromBackup(signedJson, usuarioService);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.totalChatsRestored).toBe(1);
    expect(restoreResult.totalStudiesRestored).toBe(1);

    // 5. Verificar integridad restaurada
    const restoredChats = usuarioService.listChats();
    expect(restoredChats).toHaveLength(1);
    expect(restoredChats[0].titulo).toBe('Chat de Prueba para Backup');
    expect(restoredChats[0].mensajes).toHaveLength(1);

    const restoredProfile = usuarioService.getGlobalProfile();
    expect(restoredProfile.nivel_espiritual).toBe('Maestro');
  });
});

describe('Biblioteca de Versiones en 1 Clic y Diferenciación Textual', () => {
  let bibliaService: BibliaCoreService;
  let injector: CitationInjector;

  beforeEach(async () => {
    const adapter = await SqlJsDatabaseAdapter.create();
    bibliaService = new BibliaCoreService(adapter);
    await bibliaService.initializeSchemaAndSeeds();
    injector = new CitationInjector(bibliaService);
  });

  it('debe exponer el catálogo completo con categorías y licencias transparentes', () => {
    expect(ONE_CLICK_BIBLE_CATALOG.length).toBeGreaterThanOrEqual(7);

    const vbl = ONE_CLICK_BIBLE_CATALOG.find((m) => m.id === 'VBL');
    expect(vbl).toBeDefined();
    expect(vbl?.categoria).toBe('OPEN_LICENSE');
    expect(vbl?.licenciaTipo).toBe('CREATIVE_COMMONS');

    const rvr60 = ONE_CLICK_BIBLE_CATALOG.find((m) => m.id === 'RVR1960');
    expect(rvr60).toBeDefined();
    expect(rvr60?.categoria).toBe('PERSONAL_STUDY');
    expect(rvr60?.licenciaTipo).toBe('ESTUDIO_PERSONAL');
  });

  it('debe exigir consentimiento legal únicamente en módulos de estudio personal (Categoría B)', () => {
    expect(requiresLegalConsent('RVR1960')).toBe(true);
    expect(requiresLegalConsent('NVI')).toBe(true);
    expect(requiresLegalConsent('LBLA')).toBe(true);

    expect(requiresLegalConsent('RV1909')).toBe(false);
    expect(requiresLegalConsent('VBL')).toBe(false);
    expect(requiresLegalConsent('BES')).toBe(false);
    expect(requiresLegalConsent('OSO1569')).toBe(false);

    expect(LEGAL_DISCLAIMER_TEXT).toContain('estudio bíblico personal');
    expect(LEGAL_DISCLAIMER_TEXT).toContain('memoria privada de su dispositivo');
  });

  it('debe instalar módulos en 1 clic e indexar versículos en SQLite', async () => {
    // 1. Instalar VBL
    const vblResult = await downloadAndInstallModule('VBL', bibliaService);
    expect(vblResult.totalVersesImported).toBeGreaterThanOrEqual(20);
    expect(vblResult.errors).toHaveLength(0);

    // 2. Instalar RVR1960
    const rvrResult = await downloadAndInstallModule('RVR1960', bibliaService);
    expect(rvrResult.totalVersesImported).toBeGreaterThanOrEqual(20);

    // 3. Instalar BES y OSO1569
    await downloadAndInstallModule('BES', bibliaService);
    await downloadAndInstallModule('OSO1569', bibliaService);

    // 4. Verificar versiones activas en la base de datos local
    const versions = bibliaService.listAvailableVersions();
    expect(versions).toContain('RV1909');
    expect(versions).toContain('VBL');
    expect(versions).toContain('RVR1960');
    expect(versions).toContain('BES');
    expect(versions).toContain('OSO1569');
  });

  it('debe reflejar diferencias estilísticas reales entre versiones en el inyector de citas', async () => {
    // Instalar las versiones necesarias
    await downloadAndInstallModule('VBL', bibliaService);
    await downloadAndInstallModule('BES', bibliaService);
    await downloadAndInstallModule('RVR1960', bibliaService);
    await downloadAndInstallModule('OSO1569', bibliaService);

    // Juan 3:16 en RV1909 (español clásico con tilde histórica en "á")
    const rv1909 = injector.resolveVerseOrRange('Juan', 3, 16, undefined, 'RV1909');
    expect(rv1909.text).toContain('á su Hijo unigénito');

    // Juan 3:16 en VBL (español contemporáneo)
    const vbl = injector.resolveVerseOrRange('Juan', 3, 16, undefined, 'VBL');
    expect(vbl.text).toContain('dio a su único Hijo');

    // Juan 3:16 en BES (español sencillo)
    const bes = injector.resolveVerseOrRange('Juan', 3, 16, undefined, 'BES');
    expect(bes.text).toContain('entregó a su único Hijo');

    // Juan 3:16 en RVR1960 (revisión clásica moderna)
    const rvr60 = injector.resolveVerseOrRange('Juan', 3, 16, undefined, 'RVR1960');
    expect(rvr60.text).toContain('ha dado a su Hijo unigénito');

    // Juan 3:16 en OSO1569 (Biblia del Oso 1569)
    const oso = injector.resolveVerseOrRange('Juan', 3, 16, undefined, 'OSO1569');
    expect(oso.text).toContain('ha dado a su Hijo unigénito: para que todo aquel');
  });

  it('debe inyectar citas en el texto respetando la versión bíblica seleccionada por el usuario', async () => {
    await downloadAndInstallModule('VBL', bibliaService);

    const input = 'Como dice la Escritura: [CITA: Juan 3:16]. Aleluya.';
    const injected = injector.injectCitationsInText(input, 'VBL');

    expect(injected.processedText).toContain('dio a su único Hijo');
    expect(injected.processedText).toContain('(VBL)');
  });

  it('debe hacer fallback automático a RV1909 si la versión secundaria no tiene el versículo', () => {
    // Buscar un versículo en una versión inexistente o no indexada
    const res = injector.resolveVerseOrRange('Juan', 3, 16, undefined, 'VERSION_NO_EXISTE');
    expect(res.found).toBe(false);

    // injectCitationsInText debe resolver usando RV1909 como salvaguarda
    const fallbackInjected = injector.injectCitationsInText('[CITA: Juan 3:16]', 'VERSION_NO_EXISTE');
    expect(fallbackInjected.processedText).toContain('á su Hijo unigénito');
    expect(fallbackInjected.processedText).toContain('(RV1909)');
  });

  it('debe instalar el paquete Léxico Ampliado Strong y Referencias TSK Plus', async () => {
    const res = await downloadAndInstallModule('STRONG_TSK_PLUS', bibliaService);
    expect(res.totalVersesImported).toBeGreaterThan(0);

    // Verificar que el código Strong G4991 (sōtēría) se encuentre ahora en la base de datos
    const strongSoteria = bibliaService.getStrongEntry('G4991');
    expect(strongSoteria).not.toBeNull();
    expect(strongSoteria?.transliteracion).toBe('sōtēría');
    expect(strongSoteria?.definicion).toContain('Salvación');
  });
});
