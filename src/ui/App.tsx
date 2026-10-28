import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  loadOrInitBibliaDatabase,
  loadOrInitUsuarioDatabase,
  persistBibliaDatabase,
  persistUsuarioDatabase,
} from '../core/database/persistenceService.js';
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
import { isSimpleVerseRequest, resolveVerifiedVerse } from '../core/rag/verseRequest.js';
import { brainRegistry } from '../core/inference/brain/brainRegistry.js';
import { resetNativeCache } from '../core/native-bridge/llamaNative.js';
import { runDialogueTurn } from '../core/dialogue/orchestrator.js';
import { createInitialDialogueState } from '../core/dialogue/dialogueManager.js';
import {
  mergeContinuationText,
  stripLocalLimitNote,
} from '../core/dialogue/continuation.js';
import { DialogueMode, DialogueState, PassageRef } from '../core/dialogue/types.js';
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

/**
 * Cuando el usuario pide explícitamente un versículo, un modelo pequeño a
 * veces responde con una idea piadosa pero sin referencia. En ese caso la
 * aplicación añade el texto literal ya recuperado de SQLite: no se inventa
 * nada y el usuario recibe siempre la cita que pidió.
 */
const VERSE_REQUEST_PATTERN = /\b(vers[ií]culo|pasaje|cita|texto b[ií]blico|lectura b[ií]blica)\b/i;
const ANY_BIBLICAL_REFERENCE_PATTERN = /\[CITA:|\b(?:[1-3]\s*)?[A-ZÁÉÍÓÚ][a-záéíóúñ]+\s+\d+:\d+/;

function formatPassageForQuery(passage?: PassageRef): string {
  if (!passage) return '';

  const base = `${passage.book} ${passage.chapter}`;
  if (passage.verseStart == null) return base;

  return passage.verseEnd && passage.verseEnd !== passage.verseStart
    ? `${base}:${passage.verseStart}-${passage.verseEnd}`
    : `${base}:${passage.verseStart}`;
}

/**
 * Turnos como «hazlo» no describen el tema. Si se consulta el RAG solo con esa
 * palabra, no recupera ninguna cita verificada y el documento pierde sus
 * lecturas bíblicas. En esos casos se reutiliza el tema y el pasaje acordados
 * en el turno anterior.
 */
function buildRetrievalQuery(
  text: string,
  normalizedText: string,
  state: DialogueState | null
): string {
  const compact = normalizedText.trim();
  const isContinuation =
    /^(hazlo|hazlo ya|s[ií]|dale|adelante|correcto|de acuerdo|ok|okay|genera(lo)?|redacta(lo)?|contin[uú]a|sigue|vamos)$/i.test(
      compact
    );

  if (!isContinuation || !state) return text;

  const topic = state.slots.topic ?? state.lastTopic;
  const passage = formatPassageForQuery(state.slots.passage ?? state.lastPassage);
  const focus = [topic, passage].filter(Boolean).join(' ').trim();

  return focus.length > 0 ? focus : text;
}

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

  // Asegurar tema claro angelical permanente sin clase dark residual
  useEffect(() => {
    try {
      localStorage.removeItem('verbovivo_theme');
    } catch {}
    document.documentElement.classList.remove('dark');
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
  const [activeModelName, setActiveModelName] = useState(() => brainRegistry.describeActive());

  // Diálogo ministerial: estado por chat, modo explícito y cerebro activo
  const [dialogueState, setDialogueState] = useState<DialogueState | null>(null);
  const [chatMode, setChatMode] = useState<DialogueMode>('AUTO');
  const [activeBrainLabel, setActiveBrainLabel] = useState(() => brainRegistry.describeActive());
  // Distingue «cargando el GGUF» de «generando tokens»: en un teléfono la
  // primera vez puede tardar un minuto y el usuario merece saber qué ocurre.
  const [brainActivity, setBrainActivity] = useState<
    'idle' | 'loading' | 'prefill' | 'generating'
  >('idle');
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Inicialización de bases de datos SQLite en arranque con persistencia local permanente
  useEffect(() => {
    async function initDatabases() {
      try {
        // 1. Cargar o inicializar biblia_core.sqlite desde almacenamiento privado
        const { service: bService } = await loadOrInitBibliaDatabase();

        // 2. Cargar o inicializar usuario_memoria.sqlite desde almacenamiento privado
        const { service: uService } = await loadOrInitUsuarioDatabase();

        // 3. Inyector de citas inmutables
        const injector = new CitationInjector(bService);

        setBibliaService(bService);
        setUsuarioService(uService);
        setCitationInjector(injector);

        // 4. Cargar datos de usuario y versiones canónicas
        const initialChats = uService.listChats();
        const profile = uService.getGlobalProfile();
        const loadedStudies = uService.listStudyNotes();
        const versions = bService.listAvailableVersions();

        setChats(initialChats);
        setUserProfile(profile);
        setStudies(loadedStudies);
        setCurrentLevel(profile.nivel_espiritual);
        setAvailableVersions(versions);

        // Restaurar versión bíblica guardada
        let effectiveVersion = 'RV1909';
        try {
          const savedVersion = localStorage.getItem('verbovivo_active_version');
          if (savedVersion && versions.includes(savedVersion)) {
            effectiveVersion = savedVersion;
            setActiveBibleVersion(savedVersion);
          }
        } catch {}

        // El cerebro activo se lee de la configuración persistida de BrainRegistry.
        setActiveModelName(brainRegistry.describeActive());
        setActiveBrainLabel(brainRegistry.describeActive());

        // 5. Generar Pan Diario proactivo a partir de la memoria evolutiva
        const daily = DailyBreadEngine.generateDailyBread(uService, bService, effectiveVersion);
        setDailyBreadData(daily);

        if (initialChats.length > 0) {
          setActiveChatId(initialChats[0].id);
        } else {
          // Crear chat inicial si no hay ninguno y persistir
          const firstChat = uService.createChat('Bienvenido a VerboVivo');
          await persistUsuarioDatabase(uService);
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

  // Cargar el estado de diálogo propio de cada conversación (slots, propuesta, fase).
  useEffect(() => {
    if (!usuarioService || !activeChatId) {
      setDialogueState(null);
      return;
    }

    const stored = usuarioService.getDialogueState<DialogueState>(activeChatId);
    const initial = stored ?? createInitialDialogueState({ level: currentLevel });
    setDialogueState(initial);
    setChatMode(initial.mode ?? 'AUTO');
    // currentLevel solo se usa al crear un estado nuevo; no debe recargar al cambiarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioService, activeChatId]);

  // Evitar que una generación en curso escriba en la conversación equivocada.
  useEffect(() => {
    abortControllerRef.current?.abort();
  }, [activeChatId]);

  // Refrescar la etiqueta del cerebro cuando cambia la configuración guardada.
  useEffect(() => {
    const sync = () => setActiveBrainLabel(brainRegistry.describeActive());
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  /**
   * Carga el GGUF en segundo plano cuando es el cerebro activo.
   *
   * El primer turno de una sesión pagaba la carga completa del archivo antes
   * del primer token. Al adelantarla, el usuario ve «cargando» al abrir y la
   * conversación empieza con el modelo ya en memoria.
   */
  const preloadOnDeviceBrain = useCallback(async () => {
    if (brainRegistry.getConfig().provider !== 'on-device') {
      setBrainActivity('idle');
      return;
    }

    setBrainActivity('loading');
    try {
      await brainRegistry.warmUp();
    } catch {
      // Si el archivo no está o la RAM no alcanza, el modal de modelos y el
      // propio turno muestran el error real; aquí no inventamos un estado.
    } finally {
      setBrainActivity('idle');
      setActiveBrainLabel(brainRegistry.describeActive());
    }
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    const timer = window.setTimeout(() => {
      void preloadOnDeviceBrain();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isInitializing, preloadOnDeviceBrain]);

  // Manejador para crear nueva conversación
  const handleCreateNewChat = useCallback(async () => {
    if (!usuarioService) return;
    // La conversación nueva no debe heredar el KV del turno anterior: se
    // descarta el prefijo nativo sin recargar el modelo.
    void resetNativeCache();
    const newChat = usuarioService.createChat('Nueva Consulta Teológica', '[CHARLA_CONSEJERIA]', currentLevel);
    await persistUsuarioDatabase(usuarioService);
    const updated = usuarioService.listChats();
    setChats(updated);
    setActiveChatId(newChat.id);
    setActiveTab('chat');
  }, [usuarioService, currentLevel]);

  // Manejador para eliminar chat
  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      if (!usuarioService) return;
      usuarioService.deleteChat(chatId);
      await persistUsuarioDatabase(usuarioService);
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
    async (chatId: string) => {
      if (!usuarioService) return;
      usuarioService.togglePinChat(chatId);
      await persistUsuarioDatabase(usuarioService);
      setChats(usuarioService.listChats());
    },
    [usuarioService]
  );

  // Manejador para cambiar nivel
  const handleChangeLevel = useCallback(
    async (level: UserTheologicalLevel) => {
      setCurrentLevel(level);
      if (usuarioService) {
        const updated = usuarioService.updateGlobalProfile({ nivel_espiritual: level });
        await persistUsuarioDatabase(usuarioService);
        setUserProfile(updated);
      }
    },
    [usuarioService]
  );

  // Manejador para cambiar versión bíblica canónica
  const handleSelectBibleVersion = useCallback(
    (ver: string) => {
      setActiveBibleVersion(ver);
      try {
        localStorage.setItem('verbovivo_active_version', ver);
      } catch {}
      if (usuarioService && bibliaService) {
        const updatedDaily = DailyBreadEngine.generateDailyBread(usuarioService, bibliaService, ver);
        setDailyBreadData(updatedDaily);
      }
    },
    [usuarioService, bibliaService]
  );

  // Manejador al importar nueva versión
  const handleVersionImported = useCallback(
    async (versionTag: string) => {
      if (!bibliaService) return;
      await persistBibliaDatabase(bibliaService);
      const vers = bibliaService.listAvailableVersions();
      setAvailableVersions(vers);
      setActiveBibleVersion(versionTag);
      try {
        localStorage.setItem('verbovivo_active_version', versionTag);
      } catch {}
      if (usuarioService) {
        const updatedDaily = DailyBreadEngine.generateDailyBread(usuarioService, bibliaService, versionTag);
        setDailyBreadData(updatedDaily);
      }
    },
    [bibliaService, usuarioService]
  );

  // Iniciar estudio desde versículo del Pan Diario
  const handleStartStudyFromVerse = useCallback(
    async (ref: string, verseText: string) => {
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
      await persistUsuarioDatabase(usuarioService);
      setStudies(usuarioService.listStudyNotes());
      setActiveTab('whiteboard');
    },
    [usuarioService, currentLevel, activeBibleVersion]
  );

  // Flujo principal: Escudo -> RAG -> diálogo con slots -> cerebro (o determinista) -> citas -> memoria
  const handleSendMessage = async (text: string, preferredFormat?: MinistryFormat) => {
    if (!usuarioService || !citationInjector || !activeChatId || !retriever || !memoryCompressor) {
      return;
    }

    setIsGenerating(true);
    setStreamingText('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentMessages: ChatMessage[] = activeChat ? [...activeChat.mensajes] : [];
    // La continuación debe ampliar la última respuesta del asistente, incluso
    // si el cerebro cambió desde que se escribió.
    const previousAssistantId = [...currentMessages]
      .reverse()
      .find((message) => message.role === 'assistant')?.id;
    let detectedRoute: ChatMessage['route'] = undefined;
    let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      // 1. Escudo determinista: normaliza, clasifica y detecta crisis antes de tocar el modelo.
      const shieldResult = processShield(text, currentLevel, preferredFormat);
      setLastShieldResult(shieldResult);
      detectedRoute = shieldResult.detectedRoute;

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        route: shieldResult.detectedRoute,
        level: currentLevel,
        isCrisis: shieldResult.crisis.isCrisis,
      };

      currentMessages = [...currentMessages, userMsg];

      usuarioService.saveChatMessages(activeChatId, currentMessages, {
        ruta: shieldResult.detectedRoute,
        nivel: currentLevel,
      });
      await persistUsuarioDatabase(usuarioService);
      setChats(usuarioService.listChats());

      // 2. RAG híbrido: intención cotidiana -> conceptos teológicos -> versículos verificados.
      // En aprobaciones («hazlo») se busca por el tema/pasaje acordado, no por la palabra suelta.
      const retrievalQuery = buildRetrievalQuery(text, shieldResult.normalizedText, dialogueState);
      const rewriteResult = rewriteTheologicalIntent(retrievalQuery, retrievalQuery.toLowerCase());
      const retrievedVerses = retriever.retrieve(rewriteResult, currentLevel, 5);
      setRagVersesCount(retrievedVerses.length);

      // Para «dame un versículo sobre…» la cita se resuelve aquí, contra la
      // base local, y no se pide al modelo que la recite de memoria.
      const simpleVerseRequest = isSimpleVerseRequest(text);
      const verifiedVerse =
        simpleVerseRequest && bibliaService
          ? resolveVerifiedVerse(text, bibliaService, retrievedVerses, currentLevel)
          : null;

      // Respaldo para preguntas sobre un pasaje concreto: si el modelo no cita
      // nada, se añade el versículo que el RAG recuperó para ese pasaje.
      const fallbackVerse =
        !verifiedVerse && retrievedVerses.length > 0
          ? {
              reference: `${retrievedVerses[0].versiculo.libro_nombre} ${retrievedVerses[0].versiculo.capitulo}:${retrievedVerses[0].versiculo.versiculo}`,
              text: retrievedVerses[0].versiculo.texto,
              version: retrievedVerses[0].versiculo.version || activeBibleVersion,
            }
          : null;

      // En el dispositivo cada carácter del contexto se procesa antes del
      // primer token. Un 0.5B necesita un contexto bíblico más corto; Ollama y
      // LM Studio pueden aprovechar un presupuesto mayor en PC.
      const onDevice = brainRegistry.getConfig().provider === 'on-device';
      const maxBudget = onDevice
        ? currentLevel === 'Maestro'
          ? 420
          : 280
        : currentLevel === 'Maestro'
          ? 800
          : 500;
      const groundTruth = ContextBuilder.buildGroundTruth(retrievedVerses, maxBudget, currentLevel);

      // 3. Un turno de diálogo: decide si responder, preguntar, proponer o generar documento.
      const workingState =
        dialogueState ??
        createInitialDialogueState({ mode: chatMode, level: currentLevel });

      let accumulatedOutput = '';
      // El streaming token a token re-renderiza toda la conversación. En un
      // WebView de Android eso compite con llama.cpp y puede bajar de 15 a 2
      // tokens/s. Agrupamos actualizaciones visuales cada 120 ms sin perder
      // texto: el resultado final siempre llega completo.
      let lastStreamFlush = 0;
      const flushStream = () => {
        streamFlushTimer = null;
        lastStreamFlush = Date.now();
        setStreamingText(accumulatedOutput);
      };

      const result = await runDialogueTurn({
        prompt: text,
        state: workingState,
        mode: chatMode,
        preferredLevel: currentLevel,
        preferredFormat,
        history: currentMessages,
        userProfile,
        groundTruthContext: groundTruth.promptContext,
        availableCitations: retrievedVerses.map(
          (entry) =>
            `${entry.versiculo.libro_nombre} ${entry.versiculo.capitulo}:${entry.versiculo.versiculo}`
        ),
        signal: controller.signal,
        onToken: (token) => {
          accumulatedOutput += token;
          const now = Date.now();
          if (now - lastStreamFlush >= 120) {
            flushStream();
          } else if (!streamFlushTimer) {
            streamFlushTimer = setTimeout(flushStream, 120);
          }
        },
        onActivity: (activity) =>
          setBrainActivity(activity === 'done' ? 'idle' : activity),
        shieldResult,
        verifiedVerse,
        injectCitations: (raw) => citationInjector.injectCitationsInText(raw, activeBibleVersion),
      });

      // El estado conversacional se guarda incluso si el usuario cancela a mitad de camino.
      usuarioService.saveDialogueState(activeChatId, result.state);
      setDialogueState(result.state);
      setChatMode(result.state.mode);
      setActiveBrainLabel(result.brainLabel);

      if (result.cancelled) {
        await persistUsuarioDatabase(usuarioService);
        setChats(usuarioService.listChats());
        return;
      }

      // Si el turno forma parte de un flujo documental (propuesta o redacción),
      // la ruta visible debe acompañar el trabajo y no degradarse a consejería
      // por una respuesta corta como «hazlo».
      const turnRoute =
        result.action === 'PROPOSE_PLAN' || result.action === 'GENERATE_DOCUMENT'
          ? '[CREADOR_ESTUDIO]'
          : shieldResult.detectedRoute;

      // Integridad de citas: si pidió un versículo y el modelo no citó ninguno,
      // añadimos el pasaje verificado que el RAG ya recuperó de SQLite.
      let assistantContent = result.text;
      let assistantCitations = result.citations ?? [];
      const citationFallback = verifiedVerse ?? fallbackVerse;
      if (
        VERSE_REQUEST_PATTERN.test(text) &&
        !ANY_BIBLICAL_REFERENCE_PATTERN.test(assistantContent) &&
        citationFallback
      ) {
        assistantContent = `${assistantContent}\n\n> **Texto bíblico verificado**\n> «${citationFallback.text}»\n> — *${citationFallback.reference} (${citationFallback.version})*`;
        assistantCitations = [...assistantCitations, citationFallback.text];
      }

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        route: turnRoute,
        level: currentLevel,
        citations: assistantCitations,
        truncated: result.truncated,
      };

      // Una continuación no crea una burbuja nueva: se empalma al final de la
      // respuesta anterior, que es lo que el usuario pidió retomar. El «continúa»
      // del usuario tampoco queda como mensaje suelto en el historial.
      let assistantForMemory = assistantMsg;
      let finalMessages: ChatMessage[];
      if (result.continued && previousAssistantId) {
        finalMessages = currentMessages
          .filter((message) => message.id !== userMsg.id)
          .map((message) => {
            if (message.id !== previousAssistantId) return message;
            const previousContent = stripLocalLimitNote(message.content);
            const mergedContent = mergeContinuationText(previousContent, assistantContent);
            // Un modelo pequeño a veces reescribe lo mismo y no añade nada.
            // Sin aviso, «continúa» parecería no haber hecho nada.
            const content =
              mergedContent.trim() === previousContent.trim()
                ? `${mergedContent}\n\n> **Nota:** el modelo no añadió texto nuevo al retomar. Vuelve a pulsar «Ampliar» o pide una sección concreta.`
                : mergedContent;
            assistantForMemory = {
              ...message,
              content,
              timestamp: new Date().toISOString(),
              citations: Array.from(
                new Set([...(message.citations ?? []), ...assistantCitations])
              ),
              truncated: result.truncated,
            };
            return assistantForMemory;
          });
      } else {
        finalMessages = [...currentMessages, assistantMsg].map((message) =>
          message.id === userMsg.id ? { ...message, route: turnRoute } : message
        );
      }

      const titleUpdate =
        activeChat && activeChat.mensajes.length === 0
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
          : undefined;

      usuarioService.saveChatMessages(activeChatId, finalMessages, {
        titulo: titleUpdate,
        ruta: turnRoute,
        nivel: currentLevel,
      });

      await persistUsuarioDatabase(usuarioService);
      setChats(usuarioService.listChats());
      setStreamingText('');

      // 4. Destilador de memoria global asíncrono (no bloquea la respuesta).
      memoryCompressor.scheduleCompression(activeChatId, [userMsg, assistantForMemory]);
      setTimeout(async () => {
        if (usuarioService) {
          setUserProfile(usuarioService.getGlobalProfile());
          await persistUsuarioDatabase(usuarioService);
        }
      }, 150);
    } catch (err) {
      console.error('Error procesando el turno de diálogo:', err);

      if (!controller.signal.aborted && currentMessages.length > 0) {
        const failureMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'assistant',
          content:
            '> **Nota:** No pude completar este turno por un problema interno. Tu mensaje quedó guardado; puedes reintentarlo o reformularlo.',
          timestamp: new Date().toISOString(),
          route: detectedRoute,
          level: currentLevel,
        };

        try {
          usuarioService.saveChatMessages(activeChatId, [...currentMessages, failureMsg], {
            ruta: detectedRoute,
            nivel: currentLevel,
          });
          await persistUsuarioDatabase(usuarioService);
          setChats(usuarioService.listChats());
        } catch (persistError) {
          console.error('No se pudo registrar el aviso de error:', persistError);
        }
      }
    } finally {
      if (streamFlushTimer) {
        clearTimeout(streamFlushTimer);
        streamFlushTimer = null;
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
      setStreamingText('');
      setBrainActivity('idle');
    }
  };

  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleChangeDialogueMode = useCallback(
    async (mode: DialogueMode) => {
      setChatMode(mode);

      const base = dialogueState ?? createInitialDialogueState({ mode, level: currentLevel });
      const preserveFlow = mode === 'AUTO' || mode === 'DOCUMENTO';

      const next: DialogueState = {
        ...base,
        mode,
        pendingQuestion: preserveFlow ? base.pendingQuestion : undefined,
        approvedPlan: preserveFlow ? base.approvedPlan : false,
        updatedAt: new Date().toISOString(),
      };

      setDialogueState(next);

      if (usuarioService && activeChatId) {
        usuarioService.saveDialogueState(activeChatId, next);
        await persistUsuarioDatabase(usuarioService);
      }
    },
    [dialogueState, currentLevel, usuarioService, activeChatId]
  );

  // Cancelar cualquier generación pendiente al desmontar la aplicación.
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  // Manejador para fijar mensaje a la Pizarra de Estudio
  const handlePinToStudy = useCallback(
    async (message: ChatMessage) => {
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

      await persistUsuarioDatabase(usuarioService);
      setStudies(usuarioService.listStudyNotes());
      setActiveTab('whiteboard');
    },
    [usuarioService, activeChatId, currentLevel]
  );

  // Guardar estudio desde Pizarra
  const handleSaveStudy = useCallback(
    async (note: Omit<StudyNote, 'fecha_creacion' | 'fecha_actualizacion' | 'id'> & { id?: string }) => {
      if (!usuarioService) return;
      usuarioService.saveStudyNote(note);
      await persistUsuarioDatabase(usuarioService);
      setStudies(usuarioService.listStudyNotes());
    },
    [usuarioService]
  );

  // Eliminar estudio de la Pizarra
  const handleDeleteStudy = useCallback(
    async (studyId: string) => {
      if (!usuarioService) return;
      usuarioService.deleteStudyNote(studyId);
      await persistUsuarioDatabase(usuarioService);
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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-nocturne-950 text-parchment-100 gap-3">
        <Loader2 className="w-8 h-8 text-sacred-gold animate-spin" />
        <p className="font-serif text-sm tracking-wide">
          Inicializando motores SQLite RV1909 & Memoria Evolutiva...
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-nocturne-950 overflow-hidden font-sans select-none">
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
            onCancelGeneration={handleCancelGeneration}
            activeBrainLabel={activeBrainLabel}
            brainActivity={brainActivity}
            dialogueMode={chatMode}
            onChangeDialogueMode={handleChangeDialogueMode}
            dialoguePhase={dialogueState?.phase ?? 'IDLE'}
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

      {/* Control de voz del dispositivo y prosodia */}
      <VoiceControlBar />

      {/* Modal Guía de Bienvenida e Instrucciones para Nuevo Usuario */}
      <WelcomeGuideModal
        isOpen={isWelcomeGuideOpen}
        onClose={() => setIsWelcomeGuideOpen(false)}
        onSelectPrompt={(promptText) => {
          handleSendMessage(promptText);
        }}
      />

      {/* Modal de conexión del cerebro: Ollama / LM Studio / motor determinista */}
      <ModelManagerModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        onBrainChanged={(label) => {
          setActiveBrainLabel(label);
          setActiveModelName(label);
          // Si acaba de elegir un GGUF, empieza a cargarlo ya para que el
          // primer mensaje no espere la carga completa del archivo.
          void preloadOnDeviceBrain();
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
      />
    </div>
  );
};
