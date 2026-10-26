import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SqlJsDatabaseAdapter } from '../core/database/adapters/sqlJsAdapter.js';
import { BibliaCoreService } from '../core/database/bibliaCoreService.js';
import {
  UsuarioMemoriaService,
  ChatRecord,
  ChatMessage,
  UserEvolutionProfile,
  StudyNote,
} from '../core/database/usuarioMemoriaService.js';
import { CitationInjector } from '../core/database/citationInjector.js';
import { processShield } from '../core/shield/index.js';
import { UserTheologicalLevel, ShieldProcessingResult, MinistryFormat } from '../core/shield/types.js';

// Módulos de Recuperación Aumentada (RAG), Inferencia Local y Memoria Evolutiva
import { HybridRetriever } from '../core/rag/hybridRetriever.js';
import { rewriteTheologicalIntent } from '../core/rag/queryRewriter.js';
import { ContextBuilder } from '../core/rag/contextBuilder.js';
import { localInferenceEngine } from '../core/inference/localEngine.js';
import { MemoryCompressor } from '../core/memory/memoryCompressor.js';

// Módulos de Retención Proactiva, Catálogo Bíblico y Copia de Seguridad
import { DailyBreadEngine } from '../core/retention/dailyBreadEngine.js';
import { BackupManager } from '../core/retention/backupManager.js';
import { DailyBreadCardData } from '../core/retention/types.js';

import { SidebarHistory } from './components/SidebarHistory.js';
import { ChatView } from './components/ChatView.js';
import { StudyWhiteboard } from './components/StudyWhiteboard.js';
import { StrongModal } from './components/StrongModal.js';
import { ModelManagerModal } from './components/ModelManagerModal.js';
import { BibleImporterModal } from './components/BibleImporterModal.js';
import { WelcomeGuideModal } from './components/WelcomeGuideModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { VoiceControlBar } from './components/VoiceControlBar.js';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [bibliaService, setBibliaService] = useState<BibliaCoreService | null>(null);
  const [usuarioService, setUsuarioService] = useState<UsuarioMemoriaService | null>(null);
  const [citationInjector, setCitationInjector] = useState<CitationInjector | null>(null);

  // Estados de interfaz y navegación
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard' | 'strong'>('chat');
  const [currentLevel, setCurrentLevel] = useState<UserTheologicalLevel>('Semilla');
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [studies, setStudies] = useState<StudyNote[]>([]);
  const [userProfile, setUserProfile] = useState<UserEvolutionProfile | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isWelcomeGuideOpen, setIsWelcomeGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Gestión de Atmósfera y Tema Visual (Luz Angelical por defecto)
  const [theme, setTheme] = useState<'angelic' | 'vigilia'>(() => {
    try {
      const saved = localStorage.getItem('verbovivo_theme');
      if (saved === 'vigilia') return 'vigilia';
    } catch {}
    return 'angelic';
  });

  useEffect(() => {
    try {
      localStorage.setItem('verbovivo_theme', theme);
    } catch {}
    const root = document.documentElement;
    if (theme === 'vigilia') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'angelic' ? 'vigilia' : 'angelic'));
  }, []);

  // Comprobar primer inicio para mostrar menú de bienvenida automáticamente
  useEffect(() => {
    try {
      const welcomed = localStorage.getItem('verbovivo_welcomed_v1');
      if (!welcomed) {
        setIsWelcomeGuideOpen(true);
        localStorage.setItem('verbovivo_welcomed_v1', 'true');
      }
    } catch {
      // Entorno sin localStorage
    }
  }, []);

  // Telemetría y estado de inferencia en tiempo de ejecución
  const [lastShieldResult, setLastShieldResult] = useState<ShieldProcessingResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [ragVersesCount, setRagVersesCount] = useState(0);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [activeModelName, setActiveModelName] = useState('Edge Micro (0.8B)');

  // Gestión de traducción bíblica activa y devocional
  const [activeBibleVersion, setActiveBibleVersion] = useState('RV1909');
  const [availableVersions, setAvailableVersions] = useState<string[]>(['RV1909']);
  const [dailyBreadData, setDailyBreadData] = useState<DailyBreadCardData | null>(null);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  // Instancias de servicios RAG y Memoria
  const retriever = useMemo(() => {
    return bibliaService ? new HybridRetriever(bibliaService) : null;
  }, [bibliaService]);

  const memoryCompressor = useMemo(() => {
    return usuarioService ? new MemoryCompressor(usuarioService, 2) : null;
  }, [usuarioService]);

  // Inicialización de bases de datos SQLite en arranque
  useEffect(() => {
    async function initDatabases() {
      try {
        // 1. Instanciar adaptador SQLite para biblia_core.sqlite
        const bibliaAdapter = await SqlJsDatabaseAdapter.create();
        const bService = new BibliaCoreService(bibliaAdapter);
        await bService.initializeSchemaAndSeeds();

        // 2. Instanciar adaptador SQLite para usuario_memoria.sqlite
        const usuarioAdapter = await SqlJsDatabaseAdapter.create();
        const uService = new UsuarioMemoriaService(usuarioAdapter);
        await uService.initializeSchema();

        // 3. Inyector de citas inmutables
        const injector = new CitationInjector(bService);

        setBibliaService(bService);
        setUsuarioService(uService);
        setCitationInjector(injector);

        // 4. Cargar datos de usuario
        const initialChats = uService.listChats();
        const profile = uService.getGlobalProfile();
        const loadedStudies = uService.listStudyNotes();
        const versions = bService.listAvailableVersions();

        setChats(initialChats);
        setUserProfile(profile);
        setStudies(loadedStudies);
        setCurrentLevel(profile.nivel_espiritual);
        setAvailableVersions(versions);

        // 5. Generar Pan Diario proactivo a partir de la memoria evolutiva
        const daily = DailyBreadEngine.generateDailyBread(uService, bService, 'RV1909');
        setDailyBreadData(daily);

        if (initialChats.length > 0) {
          setActiveChatId(initialChats[0].id);
        } else {
          // Crear chat inicial si no hay ninguno
          const firstChat = uService.createChat('Bienvenido a VerboVivo');
          setChats([firstChat]);
          setActiveChatId(firstChat.id);
        }
      } catch (err) {
        console.error('Error inicializando bases de datos SQLite:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    initDatabases();
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  // Manejador para crear nueva conversación
  const handleCreateNewChat = useCallback(() => {
    if (!usuarioService) return;
    const newChat = usuarioService.createChat('Nueva Consulta Teológica', '[CHARLA_CONSEJERIA]', currentLevel);
    const updated = usuarioService.listChats();
    setChats(updated);
    setActiveChatId(newChat.id);
    setActiveTab('chat');
  }, [usuarioService, currentLevel]);

  // Manejador para eliminar chat
  const handleDeleteChat = useCallback(
    (chatId: string) => {
      if (!usuarioService) return;
      usuarioService.deleteChat(chatId);
      const updated = usuarioService.listChats();
      setChats(updated);
      if (activeChatId === chatId) {
        setActiveChatId(updated.length > 0 ? updated[0].id : null);
      }
    },
    [usuarioService, activeChatId]
  );

  // Manejador para fijar/desfijar chat
  const handleTogglePinChat = useCallback(
    (chatId: string) => {
      if (!usuarioService) return;
      usuarioService.togglePinChat(chatId);
      setChats(usuarioService.listChats());
    },
    [usuarioService]
  );

  // Manejador para cambiar nivel
  const handleChangeLevel = useCallback(
    (level: UserTheologicalLevel) => {
      setCurrentLevel(level);
      if (usuarioService) {
        const updated = usuarioService.updateGlobalProfile({ nivel_espiritual: level });
        setUserProfile(updated);
      }
    },
    [usuarioService]
  );

  // Manejador para cambiar versión bíblica canónica
  const handleSelectBibleVersion = useCallback(
    (ver: string) => {
      setActiveBibleVersion(ver);
      if (usuarioService && bibliaService) {
        const updatedDaily = DailyBreadEngine.generateDailyBread(usuarioService, bibliaService, ver);
        setDailyBreadData(updatedDaily);
      }
    },
    [usuarioService, bibliaService]
  );

  // Manejador al importar nueva versión
  const handleVersionImported = useCallback(
    (versionTag: string) => {
      if (!bibliaService) return;
      const vers = bibliaService.listAvailableVersions();
      setAvailableVersions(vers);
      setActiveBibleVersion(versionTag);
      if (usuarioService) {
        const updatedDaily = DailyBreadEngine.generateDailyBread(usuarioService, bibliaService, versionTag);
        setDailyBreadData(updatedDaily);
      }
    },
    [bibliaService, usuarioService]
  );

  // Iniciar estudio desde versículo del Pan Diario
  const handleStartStudyFromVerse = useCallback(
    (ref: string, verseText: string) => {
      if (!usuarioService) return;
      usuarioService.saveStudyNote({
        titulo: `Meditación: ${ref}`,
        tema: 'Devocional Matutino',
        nivel_audiencia: currentLevel,
        versiculo_clave: ref,
        contenido_markdown: `### Reflexión Matutina\n\n> **«${verseText}»** — *${ref} (${activeBibleVersion})*\n\nEste pasaje fue entregado hoy como ancla de reposo y fortaleza para tu caminar...`,
        bosquejo_puntos: ['1. El mensaje del texto', '2. Aplicación a la jornada diaria'],
        referencias_cruzadas: ['Romanos 8:28'],
        exportado_whatsapp: false,
        exportado_pdf: false,
      });

      setStudies(usuarioService.listStudyNotes());
      setActiveTab('whiteboard');
    },
    [usuarioService, currentLevel, activeBibleVersion]
  );

  // Flujo principal de consulta: Escudo -> RAG Híbrido -> Cerebro Streaming -> Inyección Canónica -> Memoria Asíncrona
  const handleSendMessage = async (text: string, preferredFormat?: MinistryFormat) => {
    if (!usuarioService || !citationInjector || !activeChatId || !retriever || !memoryCompressor) {
      return;
    }

    setIsGenerating(true);
    setStreamingText('');

    try {
      // 1. Ejecución del Escudo Limpiador determinista (< 5ms)
      const shieldResult = processShield(text, currentLevel, preferredFormat);
      setLastShieldResult(shieldResult);

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        route: shieldResult.detectedRoute,
        level: currentLevel,
        isCrisis: shieldResult.crisis.isCrisis,
      };

      const currentMessages = activeChat ? [...activeChat.mensajes, userMsg] : [userMsg];

      // Actualizar estado del chat de inmediato en UI y SQLite
      usuarioService.saveChatMessages(activeChatId, currentMessages, {
        ruta: shieldResult.detectedRoute,
        nivel: currentLevel,
      });
      setChats(usuarioService.listChats());

      // 2. RAG Híbrido: Reescritura semántica de intención cotidiana a conceptos teológicos
      const rewriteResult = rewriteTheologicalIntent(text, shieldResult.normalizedText);
      const retrievedVerses = retriever.retrieve(rewriteResult, currentLevel, 5);
      setRagVersesCount(retrievedVerses.length);

      // 3. Empaquetador de Contexto <SCRIPTURE_GROUND_TRUTH> (Presupuesto estricto de tokens)
      const maxBudget = currentLevel === 'Maestro' ? 800 : 500;
      const groundTruth = ContextBuilder.buildGroundTruth(retrievedVerses, maxBudget, currentLevel);

      // 4. Inferencia Local Edge con Streaming fluido y salvaguarda de timeout anti-bloqueo
      let accumulatedOutput = '';
      const inferencePromise = localInferenceEngine.generate(
        shieldResult.normalizedText,
        shieldResult.detectedRoute,
        currentLevel,
        groundTruth.promptContext,
        (token) => {
          accumulatedOutput += token;
          setStreamingText(accumulatedOutput);
        },
        userProfile,
        shieldResult.detectedFormat
      );

      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Inference timeout safeguard')), 8000)
      );

      let rawAssistantResponse = '';
      try {
        rawAssistantResponse = await Promise.race([inferencePromise, timeoutPromise]);
      } catch (timeoutErr) {
        console.warn('Alcanzado límite de tiempo de inferencia, generando respuesta de respaldo:', timeoutErr);
        await localInferenceEngine.releaseMemory();
        rawAssistantResponse = await localInferenceEngine.generate(
          shieldResult.normalizedText,
          shieldResult.detectedRoute,
          currentLevel,
          groundTruth.promptContext,
          undefined,
          userProfile
        );
      }

      // 5. Protocolo de Inyección Exacta: Reemplazar [CITA: ...] con texto canónico literal de SQLite respetando la versión activa
      const { processedText, citations } = citationInjector.injectCitationsInText(rawAssistantResponse, activeBibleVersion);

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: processedText,
        timestamp: new Date().toISOString(),
        route: shieldResult.detectedRoute,
        level: currentLevel,
        citations: citations.map((c) => c.literalText),
      };

      const finalMessages = [...currentMessages, assistantMsg];

      // Título derivado si es el primer mensaje
      const titleUpdate =
        activeChat && activeChat.mensajes.length === 0
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
          : undefined;

      usuarioService.saveChatMessages(activeChatId, finalMessages, {
        titulo: titleUpdate,
        ruta: shieldResult.detectedRoute,
        nivel: currentLevel,
      });

      setChats(usuarioService.listChats());
      setStreamingText('');

      // 6. Destilador de Memoria Global Asíncrono en Tiempo Muerto (Non-blocking)
      memoryCompressor.scheduleCompression(activeChatId, [userMsg, assistantMsg]);
      // Refrescar perfil después de un micro-retardo
      setTimeout(() => {
        if (usuarioService) {
          setUserProfile(usuarioService.getGlobalProfile());
        }
      }, 150);
    } catch (err) {
      console.error('Error procesando pipeline de inferencia:', err);
    } finally {
      setIsGenerating(false);
      setStreamingText('');
    }
  };

  // Manejador para fijar mensaje a la Pizarra de Estudio
  const handlePinToStudy = useCallback(
    (message: ChatMessage) => {
      if (!usuarioService) return;
      usuarioService.saveStudyNote({
        chat_id: activeChatId || undefined,
        titulo: `Estudio Fijado (${new Date().toLocaleDateString()})`,
        tema: message.route ? message.route.replace(/[[\]]/g, '') : 'Estudio Doctrinal',
        nivel_audiencia: currentLevel,
        versiculo_clave: 'Juan 3:16',
        contenido_markdown: message.content,
        bosquejo_puntos: ['1. Exposición del texto sagrado', '2. Aplicación doctrinal'],
        referencias_cruzadas: ['Romanos 8:28'],
        exportado_whatsapp: false,
        exportado_pdf: false,
      });

      setStudies(usuarioService.listStudyNotes());
      setActiveTab('whiteboard');
    },
    [usuarioService, activeChatId, currentLevel]
  );

  // Guardar estudio desde Pizarra
  const handleSaveStudy = useCallback(
    (note: Omit<StudyNote, 'fecha_creacion' | 'fecha_actualizacion' | 'id'> & { id?: string }) => {
      if (!usuarioService) return;
      usuarioService.saveStudyNote(note);
      setStudies(usuarioService.listStudyNotes());
    },
    [usuarioService]
  );

  // Eliminar estudio de la Pizarra
  const handleDeleteStudy = useCallback(
    (studyId: string) => {
      if (!usuarioService) return;
      usuarioService.deleteStudyNote(studyId);
      setStudies(usuarioService.listStudyNotes());
    },
    [usuarioService]
  );

  // Exportar Backup Firmado
  const handleExportBackup = useCallback(() => {
    if (!usuarioService) return;
    const backupJson = BackupManager.createSignedBackup(usuarioService);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verbovivo_backup_signed_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [usuarioService]);

  if (isInitializing) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-nocturne-950 text-parchment-100 gap-3">
        <Loader2 className="w-8 h-8 text-sacred-gold animate-spin" />
        <p className="font-serif text-sm tracking-wide">
          Inicializando motores SQLite RV1909 & Memoria Evolutiva...
        </p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex bg-nocturne-950 overflow-hidden font-sans select-none">
      {/* Barra Lateral: Historiales, Memoria y Cerebro */}
      {userProfile && (
        <SidebarHistory
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={setActiveChatId}
          onCreateNewChat={handleCreateNewChat}
          onDeleteChat={handleDeleteChat}
          onTogglePinChat={handleTogglePinChat}
          userProfile={userProfile}
          onExportBackup={handleExportBackup}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenModelManager={() => setIsModelModalOpen(true)}
          activeModelName={activeModelName}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onOpenWelcomeGuide={() => setIsWelcomeGuideOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Vista Principal */}
      <main className="flex-1 h-full flex flex-col overflow-hidden">
        {activeTab === 'chat' && (
          <ChatView
            chat={activeChat}
            onSendMessage={handleSendMessage}
            currentLevel={currentLevel}
            onChangeLevel={handleChangeLevel}
            onPinToStudy={handlePinToStudy}
            lastShieldResult={lastShieldResult}
            isGenerating={isGenerating}
            streamingText={streamingText}
            ragVersesCount={ragVersesCount}
            onOpenModelManager={() => setIsModelModalOpen(true)}
            activeBibleVersion={activeBibleVersion}
            availableVersions={availableVersions}
            onSelectBibleVersion={handleSelectBibleVersion}
            onOpenBibleImporter={() => setIsImporterOpen(true)}
            dailyBreadData={dailyBreadData}
            onStartStudyFromVerse={handleStartStudyFromVerse}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
            onOpenWelcomeGuide={() => setIsWelcomeGuideOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {activeTab === 'whiteboard' && (
          <StudyWhiteboard
            studies={studies}
            onSaveStudy={handleSaveStudy}
            onDeleteStudy={handleDeleteStudy}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          />
        )}

        {activeTab === 'strong' && bibliaService && (
          <StrongModal
            bibliaService={bibliaService}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          />
        )}
      </main>

      {/* Mini-Panel de Control de Voz Neural HD y Prosodia */}
      <VoiceControlBar />

      {/* Modal Guía de Bienvenida e Instrucciones para Nuevo Usuario */}
      <WelcomeGuideModal
        isOpen={isWelcomeGuideOpen}
        onClose={() => setIsWelcomeGuideOpen(false)}
        onSelectPrompt={(promptText) => {
          handleSendMessage(promptText);
        }}
      />

      {/* Modal Gestor del Motor de Inferencia On-Device */}
      <ModelManagerModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        activeModelId={localInferenceEngine.getActiveModelId()}
        onModelActivated={(modelId) => {
          localInferenceEngine.setActiveModelId(modelId);
          setActiveModelName(modelId === 'ULTRALIGHT' ? 'Edge Micro (0.8B)' : 'Edge Standard (1.5B)');
          setIsModelModalOpen(false);
        }}
      />

      {/* Modal de Traducciones Bíblicas y Catálogo Canónico */}
      {bibliaService && (
        <BibleImporterModal
          isOpen={isImporterOpen}
          onClose={() => setIsImporterOpen(false)}
          bibliaService={bibliaService}
          onVersionImported={handleVersionImported}
        />
      )}

      {/* Centro Unificado de Ajustes Modernos del Sistema */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentLevel={currentLevel}
        onChangeLevel={handleChangeLevel}
        activeBibleVersion={activeBibleVersion}
        availableVersions={availableVersions}
        onSelectBibleVersion={handleSelectBibleVersion}
        onOpenBibleImporter={() => {
          setIsSettingsOpen(false);
          setIsImporterOpen(true);
        }}
        onOpenModelManager={() => {
          setIsSettingsOpen(false);
          setIsModelModalOpen(true);
        }}
        activeModelName={activeModelName}
        userProfile={userProfile || undefined}
        onExportBackup={handleExportBackup}
        onOpenWelcomeGuide={() => {
          setIsSettingsOpen(false);
          setIsWelcomeGuideOpen(true);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />
    </div>
  );
};
