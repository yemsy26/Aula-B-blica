import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatRecord } from '../../core/database/usuarioMemoriaService.js';
import { UserTheologicalLevel, ShieldProcessingResult, MinistryFormat } from '../../core/shield/types.js';
import { LevelSelector } from './LevelSelector.js';
import { CrisisBanner } from './CrisisBanner.js';
import {
  Send,
  Zap,
  BookmarkPlus,
  Copy,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  Cpu,
  Volume2,
  Square,
  FileUp,
  Menu,
  Sun,
  HelpCircle,
} from 'lucide-react';
import { offlineTts } from '../../core/tts/offlineTtsService.js';
import { DailyBreadCardData } from '../../core/retention/types.js';
import { DailyBreadCard } from './DailyBreadCard.js';
import { copyToClipboard } from '../../core/utils/clipboard.js';

interface ChatViewProps {
  chat: ChatRecord | null;
  onSendMessage: (text: string, format?: MinistryFormat) => Promise<void>;
  currentLevel: UserTheologicalLevel;
  onChangeLevel: (level: UserTheologicalLevel) => void;
  onPinToStudy: (message: ChatMessage) => void;
  lastShieldResult: ShieldProcessingResult | null;
  isGenerating: boolean;
  streamingText?: string;
  ragVersesCount?: number;
  onOpenModelManager?: () => void;
  activeBibleVersion?: string;
  availableVersions?: string[];
  onSelectBibleVersion?: (version: string) => void;
  onOpenBibleImporter?: () => void;
  dailyBreadData?: DailyBreadCardData | null;
  onStartStudyFromVerse?: (ref: string, verseText: string) => void;
  onToggleMobileSidebar?: () => void;
  onOpenWelcomeGuide?: () => void;
}

const FORMAT_PILLS: { id: MinistryFormat; label: string }[] = [
  { id: 'AUTO', label: '⚡ Auto' },
  { id: 'SERMON_CULTO', label: '🎙️ Sermón de Culto' },
  { id: 'ESTUDIO_CLASE', label: '📚 Estudio Profundo' },
  { id: 'CELULA_JOVENES', label: '👥 Célula / Jóvenes' },
  { id: 'SERIE_CAMPANA', label: '🗓️ Serie 4 Semanas' },
  { id: 'CONSEJERIA_DIALOGO', label: '💬 Consejería' },
];

// Función auxiliar para parsear markdown simple (negrita, cursiva, código)
const renderFormattedInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-sacred-gold-light">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-nocturne-950 font-mono text-xs text-sacred-gold border border-nocturne-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

// Renderizador estructurado de contenido teológico y citas canónicas
const renderMessageContent = (content: string) => {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, bIdx) => {
    const trimmed = block.trim();

    // Bloque de Cita Canónica Inmutable
    if (trimmed.startsWith('>')) {
      const lines = trimmed.split('\n').map((l) => l.replace(/^>\s*/, '').trim());
      let quoteText = '';
      let citation = '';

      if (lines.length > 1 && lines[lines.length - 1].startsWith('—')) {
        citation = lines[lines.length - 1].replace(/^[—\s*]+|[*\s]+$/g, '');
        quoteText = lines.slice(0, -1).join(' ');
      } else {
        quoteText = lines.join(' ');
      }

      const cleanQuote = quoteText.replace(/^[«"'\s*]+|[»"'\s*]+$/g, '').replace(/\*\*/g, '');

      return (
        <div
          key={bIdx}
          className="verse-quote-card my-2.5 sm:my-3 p-3 sm:p-3.5 rounded-xl border-l-4 border-sacred-gold bg-gradient-to-r from-sacred-gold/15 via-sacred-gold/5 to-transparent font-bible text-parchment-100 shadow-sm"
        >
          <p className="italic text-xs sm:text-sm leading-relaxed">
            «{cleanQuote}»
          </p>
          {citation && (
            <div className="mt-1.5 text-right font-sans text-[11px] sm:text-xs not-italic text-sacred-gold font-semibold">
              — {citation}
            </div>
          )}
        </div>
      );
    }

    // Encabezados Markdown
    if (trimmed.startsWith('###')) {
      return (
        <h4 key={bIdx} className="font-serif font-bold text-xs sm:text-sm text-parchment-100 mt-2 mb-1">
          {trimmed.replace(/^###\s*/, '')}
        </h4>
      );
    }

    // Párrafos convencionales
    return (
      <div key={bIdx} className="space-y-1">
        {block.split('\n').map((line, lIdx) => (
          <p key={lIdx} className="leading-relaxed">
            {renderFormattedInline(line)}
          </p>
        ))}
      </div>
    );
  });
};

export const ChatView: React.FC<ChatViewProps> = ({
  chat,
  onSendMessage,
  currentLevel,
  onChangeLevel,
  onPinToStudy,
  lastShieldResult,
  isGenerating,
  streamingText = '',
  ragVersesCount = 0,
  onOpenModelManager,
  activeBibleVersion = 'RV1909',
  availableVersions = ['RV1909'],
  onSelectBibleVersion,
  onOpenBibleImporter,
  dailyBreadData,
  onStartStudyFromVerse,
  onToggleMobileSidebar,
  onOpenWelcomeGuide,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showDailyBread, setShowDailyBread] = useState(true);
  const [isCrisisDismissed, setIsCrisisDismissed] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<MinistryFormat>('AUTO');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleQuickPrompt = (promptText: string) => {
    setInputText('');
    onSendMessage(promptText, 'AUTO');
  };

  useEffect(() => {
    const unsub = offlineTts.subscribe((st) => {
      if (!st.isPlaying && !st.isPaused) {
        setPlayingMessageId(null);
      }
    });
    return unsub;
  }, []);

  const toggleSpeak = (id: string, text: string) => {
    if (playingMessageId === id) {
      offlineTts.stop();
      setPlayingMessageId(null);
    } else {
      offlineTts.stop();
      setPlayingMessageId(id);
      offlineTts.speak(text, () => {
        setPlayingMessageId(null);
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.mensajes, isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const msg = inputText;
    setInputText('');
    await onSendMessage(msg, selectedFormat);
  };

  const copyText = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-nocturne-950 overflow-hidden text-zinc-200">
      {/* Barra Superior del Chat (Responsive) */}
      <header className="px-3 sm:px-6 py-2 sm:py-3 border-b border-nocturne-800 bg-nocturne-900/70 backdrop-blur-md flex items-center justify-between z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Botón de Menú Móvil Prominente para abrir historial */}
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="md:hidden px-2.5 py-1.5 rounded-xl bg-sacred-gold/15 hover:bg-sacred-gold/25 text-sacred-gold border border-sacred-gold/30 transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 cursor-pointer"
              title="Abrir historial de conversaciones y menú"
            >
              <Menu className="w-4 h-4" />
              <span className="text-xs font-semibold">Menú</span>
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-serif font-bold text-parchment-100 flex items-center gap-1.5 truncate">
              <span className="truncate">{chat ? chat.titulo : 'Nueva Consulta'}</span>
              {chat && (
                <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded-full bg-nocturne-800 text-sacred-gold font-mono border border-nocturne-700 shrink-0">
                  {chat.ruta_predominante.replace(/[[\]]/g, '')}
                </span>
              )}
            </h2>
            <p className="hidden md:block text-[11px] text-zinc-400 mt-0.5">
              Canon RV1909 · Exégesis Edge Inmutable · 100% Offline
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera: Guía, Pan Diario, Canon, Nivel y Cerebro */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Botón Guía de Bienvenida / Ayuda (visible en sm+) */}
          {onOpenWelcomeGuide && (
            <button
              type="button"
              onClick={onOpenWelcomeGuide}
              className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-nocturne-900 hover:bg-nocturne-850 border border-nocturne-800 hover:border-sacred-gold/40 text-zinc-300 hover:text-sacred-gold text-xs items-center gap-1 transition-colors"
              title="Guía de uso para nuevos usuarios"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sacred-gold shrink-0" />
              <span className="text-[11px] font-medium">Guía</span>
            </button>
          )}

          {/* Alternador de Pan Diario */}
          {dailyBreadData && (
            <button
              type="button"
              onClick={() => setShowDailyBread((prev) => !prev)}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs flex items-center gap-1 border transition-all ${
                showDailyBread
                  ? 'bg-sacred-gold/20 border-sacred-gold/50 text-sacred-gold-light'
                  : 'bg-nocturne-900 border-nocturne-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={showDailyBread ? 'Ocultar Pan Diario' : 'Mostrar Pan Diario'}
            >
              <Sun className="w-3.5 h-3.5 text-sacred-gold shrink-0" />
              <span className="hidden xl:inline text-[11px] font-medium">Pan Diario</span>
            </button>
          )}

          {/* Selector de Versión Canónica */}
          <div className="flex items-center gap-1 bg-nocturne-950 border border-nocturne-800 rounded-xl px-1.5 sm:px-2 py-1">
            <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">Canon:</span>
            <select
              value={activeBibleVersion}
              onChange={(e) => onSelectBibleVersion && onSelectBibleVersion(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-mono font-bold text-sacred-gold focus:outline-none cursor-pointer"
            >
              {availableVersions.map((v) => (
                <option key={v} value={v} className="bg-nocturne-900 text-zinc-200">
                  {v}
                </option>
              ))}
            </select>
            {onOpenBibleImporter && (
              <button
                type="button"
                onClick={onOpenBibleImporter}
                className="p-0.5 rounded text-zinc-400 hover:text-sacred-gold transition-colors"
                title="Importar traducción externa (BYOB)"
              >
                <FileUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <LevelSelector currentLevel={currentLevel} onChange={onChangeLevel} />

          {/* Gestor del Cerebro (visible en sm+) */}
          {onOpenModelManager && (
            <button
              type="button"
              onClick={onOpenModelManager}
              className="hidden sm:flex p-1.5 sm:p-2 rounded-xl bg-nocturne-900 border border-nocturne-800 hover:border-sacred-gold/40 text-sacred-gold transition-colors"
              title="Gestionar Cerebro Edge AI"
            >
              <Cpu className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Banner de Crisis Pastoral si se detecta alerta activa y no ha sido descartado */}
      {lastShieldResult?.crisis.isCrisis && !isCrisisDismissed && (
        <CrisisBanner
          crisis={lastShieldResult.crisis}
          onDismiss={() => setIsCrisisDismissed(true)}
        />
      )}

      {/* Feed de Mensajes con Scroll Independiente */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Tarjeta Devocional Pan Diario dentro del Scroll (no bloquea mensajes) */}
        {showDailyBread && dailyBreadData && (
          <DailyBreadCard
            data={dailyBreadData}
            onStartStudyFromVerse={(ref, text) => {
              if (onStartStudyFromVerse) onStartStudyFromVerse(ref, text);
            }}
            onDismiss={() => setShowDailyBread(false)}
          />
        )}

        {!chat || chat.mensajes.length === 0 ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center p-2 sm:p-6 max-w-2xl mx-auto space-y-4">
            {/* Tarjeta de Bienvenida Principal */}
            <div className="w-full p-4 sm:p-6 rounded-2xl bg-gradient-to-b from-nocturne-900 via-nocturne-900/90 to-nocturne-950 border border-sacred-gold/30 shadow-xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sacred-gold/15 border border-sacred-gold/30 flex items-center justify-center text-sacred-gold text-2xl mx-auto shadow-inner">
                ✝
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-parchment-100">
                  Bienvenido a VerboVivo
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Tu asistente bíblico y pastoral <strong>100% Offline</strong> con memoria global evolutiva,
                  canon inmutable RV1909 y cero alucinaciones doctrinales.
                </p>
              </div>

              {onOpenWelcomeGuide && (
                <button
                  type="button"
                  onClick={onOpenWelcomeGuide}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sacred-gold/20 hover:bg-sacred-gold/30 text-sacred-gold-light border border-sacred-gold/40 text-xs font-semibold transition-all shadow-sm"
                >
                  <HelpCircle className="w-4 h-4 text-sacred-gold" />
                  <span>¿Nuevo usuario? Ver Guía y Mapa del Sistema</span>
                </button>
              )}
            </div>

            {/* Categorías de Inicio Rápido */}
            <div className="w-full space-y-2.5 pt-1">
              <span className="block text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-semibold text-center">
                Elige un tema para comenzar inmediatamente
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Estudios Bíblicos */}
                <div className="p-3 rounded-xl bg-nocturne-900/70 border border-nocturne-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-sacred-gold font-semibold flex items-center gap-1">
                    📖 Estudios por Libro
                  </span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('quiero estudiar el libro de mateo que me recomiendas')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-white border border-nocturne-800 hover:border-sacred-gold/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Estudiar el libro de Mateo"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('quiero estudiar la carta a los romanos')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-white border border-nocturne-800 hover:border-sacred-gold/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Carta a los Romanos"
                    </button>
                  </div>
                </div>

                {/* 2. Consejería Pastoral */}
                <div className="p-3 rounded-xl bg-nocturne-900/70 border border-nocturne-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold flex items-center gap-1">
                    🕊️ Consejería & Paz
                  </span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('tengo mucha ansiedad y miedo por mi futuro que dice la biblia')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-white border border-nocturne-800 hover:border-emerald-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Ansiedad y miedo al futuro"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('xq dios permite q suframos tanto si nos ama?')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-white border border-nocturne-800 hover:border-emerald-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "¿Por qué sufrimos?"
                    </button>
                  </div>
                </div>

                {/* 3. Exégesis y Raíces */}
                <div className="p-3 rounded-xl bg-nocturne-900/70 border border-nocturne-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-semibold flex items-center gap-1">
                    🏛️ Exégesis & Raíces
                  </span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('analiza el significado exegetico de bara H1254 en genesis 1:1')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-white border border-nocturne-800 hover:border-indigo-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Raíz bará H1254 (Génesis 1:1)"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('explicame el pacto abrahamico y su relacion con cristo')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-white border border-nocturne-800 hover:border-indigo-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Pacto Abrahámico y Cristo"
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          chat.mensajes.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} smooth-gpu`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 px-1">
                  <span className="text-[10px] font-mono text-zinc-400">
                    {isUser ? 'Tú' : 'VerboVivo'}
                  </span>
                  {msg.level && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-nocturne-900 text-zinc-400 border border-nocturne-800 font-mono">
                      {msg.level}
                    </span>
                  )}
                  {msg.route && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-nocturne-900 text-sacred-gold border border-nocturne-800 font-mono">
                      {msg.route.replace(/[[\]]/g, '')}
                    </span>
                  )}
                </div>

                <div
                  className={`relative max-w-[92%] sm:max-w-2xl p-3 sm:p-4 rounded-2xl shadow-sm leading-relaxed ${
                    isUser
                      ? 'bg-sacred-gold/15 text-parchment-100 border border-sacred-gold/30 rounded-tr-none'
                      : 'bg-nocturne-900 text-zinc-200 border border-nocturne-800 rounded-tl-none font-bible'
                  }`}
                >
                  {/* Contenido con formateo limpio de citas e inline markdown */}
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    {renderMessageContent(msg.content)}
                  </div>

                  {/* Acciones de Mensaje (Copiar / Fijar a Estudio / Voz) */}
                  {!isUser && (
                    <div className="mt-2.5 pt-2 border-t border-nocturne-800 flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-mono text-[9px] sm:text-[10px]">Citas Exactas {activeBibleVersion || 'RV1909'}</span>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggleSpeak(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-colors text-[10px] sm:text-[11px] ${
                            playingMessageId === msg.id
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                              : 'bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-sacred-gold'
                          }`}
                          title="Leer con voz offline natural"
                        >
                          {playingMessageId === msg.id ? (
                            <Square className="w-3 h-3 fill-current" />
                          ) : (
                            <Volume2 className="w-3 h-3 text-sacred-gold" />
                          )}
                          <span>Voz</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onPinToStudy(msg)}
                          className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-sacred-gold transition-colors text-[10px] sm:text-[11px]"
                          title="Fijar en Pizarra de Estudio"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          <span>Fijar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyText(msg.id, msg.content)}
                          className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-white transition-colors text-[10px] sm:text-[11px]"
                          title="Copiar texto"
                        >
                          {copiedId === msg.id ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isGenerating && streamingText && (
          <div className="flex flex-col items-start smooth-gpu">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-mono text-zinc-400">
                VerboVivo (Generando...)
              </span>
            </div>
            <div className="relative max-w-[92%] sm:max-w-2xl p-3 sm:p-4 rounded-2xl rounded-tl-none bg-nocturne-900 text-zinc-200 border border-sacred-gold/30 font-bible text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
              {streamingText}
              <span className="inline-block w-1.5 h-4 ml-1 bg-sacred-gold animate-pulse align-middle" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Telemetría del Escudo Limpiador y RAG Híbrido en Tiempo Real */}
      {lastShieldResult && (
        <div className="px-3 sm:px-6 py-1 sm:py-1.5 bg-nocturne-900/90 border-t border-nocturne-800/80 flex flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] text-zinc-400 font-mono">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <Zap className="w-3 h-3 text-sacred-gold" />
            <span>Escudo: {lastShieldResult.processingTimeMs} ms</span>
            <span className="text-zinc-600">|</span>
            <span>RAG Híbrido: {ragVersesCount} citas</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300">Ruta: {lastShieldResult.detectedRoute}</span>
          </div>
          {lastShieldResult.normalizedText !== lastShieldResult.originalText && (
            <div className="truncate max-w-[200px] sm:max-w-xs text-zinc-400" title={lastShieldResult.normalizedText}>
              Norm: "{lastShieldResult.normalizedText}"
            </div>
          )}
        </div>
      )}

      {/* Área de Entrada de Texto con Selector de Formato Ministerial */}
      <footer className="p-2.5 sm:p-4 bg-nocturne-900 border-t border-nocturne-800">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Selector Rápido de Formatos Ministeriales */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] px-0.5">
            {FORMAT_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedFormat(pill.id)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border font-medium flex items-center gap-1 cursor-pointer ${
                  selectedFormat === pill.id
                    ? 'bg-sacred-gold text-nocturne-950 border-sacred-gold shadow-sm font-semibold'
                    : 'bg-nocturne-950/80 text-zinc-400 hover:text-zinc-200 border-nocturne-800 hover:border-nocturne-700'
                }`}
              >
                <span>{pill.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-1.5 sm:gap-2">
            <div className="flex-1 relative bg-nocturne-950 rounded-xl sm:rounded-2xl border border-nocturne-750 focus-within:border-sacred-gold transition-colors shadow-inner">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={`Escribe tu consulta en español cotidiano o jerga (Nivel ${currentLevel})...`}
                className="w-full p-2.5 sm:p-3.5 bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isGenerating}
              className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-sacred-gold hover:bg-sacred-gold-light text-nocturne-950 font-bold shadow-md transition-all duration-200 smooth-gpu shrink-0 ${
                !inputText.trim() || isGenerating
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:scale-105 cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
};
