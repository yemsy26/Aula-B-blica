import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatRecord } from '../../core/database/usuarioMemoriaService.js';
import { UserTheologicalLevel, ShieldProcessingResult, MinistryFormat } from '../../core/shield/types.js';
import { DialogueMode, DialoguePhase } from '../../core/dialogue/types.js';
import { LevelSelector } from './LevelSelector.js';
import { CrisisBanner } from './CrisisBanner.js';
import {
  Send,
  Zap,
  BookmarkPlus,
  Copy,
  CheckCircle,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  Square,
  Menu,
  Sun,
  HelpCircle,
  Settings,
  BookOpen,
  Loader2,
  ArrowRight,
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
  onOpenSettings?: () => void;
  onCancelGeneration?: () => void;
  activeBrainLabel?: string;
  brainActivity?: 'idle' | 'loading' | 'prefill' | 'generating';
  dialogueMode?: DialogueMode;
  onChangeDialogueMode?: (mode: DialogueMode) => void;
  dialoguePhase?: DialoguePhase;
}

const LEVEL_ACCENTS: Record<UserTheologicalLevel, {
  pillClass: string;
  focusClass: string;
  dotClass: string;
}> = {
  Semilla: {
    pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm',
    focusClass: 'focus-within:border-emerald-500/60 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.18)]',
    dotClass: 'bg-emerald-600',
  },
  Discipulo: {
    pillClass: 'bg-sky-50 text-sky-850 border-sky-300 shadow-sm',
    focusClass: 'focus-within:border-sky-500/60 focus-within:shadow-[0_0_20px_rgba(2,132,199,0.18)]',
    dotClass: 'bg-sky-600',
  },
  Maestro: {
    pillClass: 'bg-amber-50 text-amber-900 border-amber-300 shadow-sm',
    focusClass: 'focus-within:border-amber-500/60 focus-within:shadow-[0_0_20px_rgba(217,119,6,0.18)]',
    dotClass: 'bg-amber-600',
  },
};

const FORMAT_PILLS: { id: MinistryFormat; label: string }[] = [
  { id: 'AUTO', label: '⚡ Auto' },
  { id: 'SERMON_CULTO', label: '🎙️ Sermón de Culto' },
  { id: 'ESTUDIO_CLASE', label: '📚 Estudio Profundo' },
  { id: 'CELULA_JOVENES', label: '👥 Célula / Jóvenes' },
  { id: 'SERIE_CAMPANA', label: '🗓️ Serie 4 Semanas' },
  { id: 'CONSEJERIA_DIALOGO', label: '💬 Consejería' },
];

const DIALOGUE_MODES: { id: DialogueMode; label: string; title: string }[] = [
  { id: 'AUTO', label: 'Auto', title: 'Decide si responder, preguntar, proponer o redactar' },
  { id: 'CONSULTA', label: 'Consulta', title: 'Respuesta directa y conversacional' },
  { id: 'ESTUDIO', label: 'Estudio', title: 'Exégesis y análisis profundo, sin documento extenso' },
  { id: 'CONSEJERIA', label: 'Consejería', title: 'Acompañamiento pastoral con límites claros' },
  { id: 'DOCUMENTO', label: 'Documento', title: 'Preparar un sermón, clase o material completo' },
];

const PHASE_LABELS: Record<DialoguePhase, string> = {
  IDLE: '',
  DISCOVER: 'Explorando',
  CLARIFY: 'Aclarando',
  PROPOSE: 'Propuesta lista',
  CONFIRM: 'Confirmación',
  GENERATE: 'Redactando',
  FOLLOW_UP: 'En diálogo',
};

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

const splitTableRow = (line: string): string[] =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isTableSeparator = (line: string): boolean =>
  /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/.test(line);

const isTableBlock = (block: string): boolean => {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    lines.length >= 2 &&
    lines.every((line) => line.includes('|')) &&
    isTableSeparator(lines[1])
  );
};

const headingClass = (level: number): string => {
  if (level <= 1) return 'text-base sm:text-lg mt-3 mb-1.5';
  if (level === 2) return 'text-sm sm:text-base mt-2.5 mb-1';
  if (level === 3) return 'text-xs sm:text-sm mt-2 mb-1';
  return 'text-[11px] sm:text-xs mt-1.5 mb-0.5 uppercase tracking-wide';
};

const BULLET_PATTERN = /^[-*+]\s+/;
const ORDERED_PATTERN = /^\d+[.)]\s+/;
const HEADING_PATTERN = /^(#{1,4})\s+(.+)$/;

/**
 * Renderiza líneas sueltas de un bloque: encabezados, listas, separadores y párrafos.
 * Un mismo bloque puede mezclar todo lo anterior cuando el modelo usa saltos simples.
 */
const renderBodyLines = (lines: string[], keyPrefix: string): React.ReactNode[] => {
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  const nodes: React.ReactNode[] = [];
  let index = 0;

  while (index < clean.length) {
    const line = clean[index];

    if (/^-{3,}$/.test(line)) {
      nodes.push(<hr key={`${keyPrefix}-hr-${index}`} className="my-2 border-nocturne-800" />);
      index++;
      continue;
    }

    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push(
        <h4
          key={`${keyPrefix}-h-${index}`}
          className={`font-serif font-bold text-parchment-100 ${headingClass(level)}`}
        >
          {renderFormattedInline(headingMatch[2])}
        </h4>
      );
      index++;
      continue;
    }

    if (BULLET_PATTERN.test(line) || ORDERED_PATTERN.test(line)) {
      const ordered = ORDERED_PATTERN.test(line);
      const pattern = ordered ? ORDERED_PATTERN : BULLET_PATTERN;
      const items: string[] = [];

      while (index < clean.length && pattern.test(clean[index])) {
        items.push(clean[index].replace(pattern, ''));
        index++;
      }

      nodes.push(
        ordered ? (
          <ol
            key={`${keyPrefix}-ol-${index}`}
            className="list-decimal pl-5 space-y-1 marker:text-sacred-gold marker:font-semibold"
          >
            {items.map((item, itemIdx) => (
              <li key={itemIdx} className="leading-relaxed">
                {renderFormattedInline(item)}
              </li>
            ))}
          </ol>
        ) : (
          <ul
            key={`${keyPrefix}-ul-${index}`}
            className="list-disc pl-5 space-y-1 marker:text-sacred-gold"
          >
            {items.map((item, itemIdx) => (
              <li key={itemIdx} className="leading-relaxed">
                {renderFormattedInline(item)}
              </li>
            ))}
          </ul>
        )
      );
      continue;
    }

    nodes.push(
      <p key={`${keyPrefix}-p-${index}`} className="leading-relaxed">
        {renderFormattedInline(line)}
      </p>
    );
    index++;
  }

  return nodes;
};

// Renderizador estructurado de contenido teológico y citas canónicas
const renderMessageContent = (content: string, onActionClick?: (actionText: string) => void) => {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

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

    // Tablas Markdown (| columna | columna |)
    if (isTableBlock(trimmed)) {
      const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
      const header = splitTableRow(lines[0]);
      const rows = lines.slice(2).map(splitTableRow);

      return (
        <div key={bIdx} className="my-2 overflow-x-auto rounded-lg border border-nocturne-800">
          <table className="w-full border-collapse text-[11px] sm:text-xs">
            <thead className="bg-nocturne-850/80">
              <tr>
                {header.map((cell, cIdx) => (
                  <th
                    key={cIdx}
                    className="px-2.5 py-1.5 text-left font-semibold text-sacred-gold-light border-b border-nocturne-800 whitespace-nowrap"
                  >
                    {renderFormattedInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="odd:bg-nocturne-900/40">
                  {header.map((_, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-2.5 py-1.5 align-top border-b border-nocturne-800/60 text-zinc-300"
                    >
                      {renderFormattedInline(row[cIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Encabezados Markdown (#, ##, ###, ####), con posible cuerpo en el mismo bloque
    const firstNewline = trimmed.indexOf('\n');
    const firstLine = firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline);
    const restOfBlock = firstNewline === -1 ? '' : trimmed.slice(firstNewline + 1);
    const headingMatch = firstLine.match(HEADING_PATTERN);

    if (headingMatch) {
      const level = headingMatch[1].length;
      return (
        <div key={bIdx} className="space-y-1">
          <h4 className={`font-serif font-bold text-parchment-100 ${headingClass(level)}`}>
            {renderFormattedInline(headingMatch[2])}
          </h4>
          {renderBodyLines(restOfBlock.split('\n'), `${bIdx}-body`)}
        </div>
      );
    }

    // Comprobar si el bloque contiene etiquetas de acuerdos o botones interactivos [ACUERDO: ...]
    const agreementMatches = Array.from(block.matchAll(/\[ACUERDO:\s*([^\]]+)\]/gi));
    if (agreementMatches.length > 0) {
      const textWithoutAgreements = block.replace(/\[ACUERDO:\s*[^\]]+\]\s*/gi, '').trim();
      return (
        <div key={bIdx} className="space-y-2">
          {textWithoutAgreements && (
            <div className="space-y-1">
              {renderBodyLines(textWithoutAgreements.split('\n'), `${bIdx}-agreement`)}
            </div>
          )}
          <div className="pt-1 flex flex-wrap gap-2">
            {agreementMatches.map((match, aIdx) => {
              const actionLabel = match[1].trim();
              return (
                <button
                  key={aIdx}
                  type="button"
                  onClick={() => onActionClick?.(actionLabel)}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sacred-gold/25 via-sacred-gold/15 to-amber-500/20 hover:from-sacred-gold/40 hover:to-amber-500/35 border border-sacred-gold/50 text-sacred-gold-light hover:text-white font-medium text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-left cursor-pointer group"
                >
                  <Zap className="w-3.5 h-3.5 text-sacred-gold group-hover:scale-110 transition-transform shrink-0" />
                  <span>{actionLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Separador horizontal
    if (trimmed === '---') {
      return <hr key={bIdx} className="my-2 border-nocturne-800" />;
    }

    // Listas ordenadas y no ordenadas
    const listLines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
    const isUnorderedList = listLines.length > 0 && listLines.every((line) => /^[-*+]\s+/.test(line));
    const isOrderedList = listLines.length > 0 && listLines.every((line) => /^\d+[.)]\s+/.test(line));

    if (isUnorderedList || isOrderedList) {
      const items = listLines.map((line) =>
        line.replace(isOrderedList ? /^\d+[.)]\s+/ : /^[-*+]\s+/, '')
      );

      return isOrderedList ? (
        <ol key={bIdx} className="list-decimal pl-5 space-y-1 marker:text-sacred-gold marker:font-semibold">
          {items.map((item, iIdx) => (
            <li key={iIdx} className="leading-relaxed">
              {renderFormattedInline(item)}
            </li>
          ))}
        </ol>
      ) : (
        <ul key={bIdx} className="list-disc pl-5 space-y-1 marker:text-sacred-gold">
          {items.map((item, iIdx) => (
            <li key={iIdx} className="leading-relaxed">
              {renderFormattedInline(item)}
            </li>
          ))}
        </ul>
      );
    }

    // Párrafos, listas y encabezados mezclados en un mismo bloque
    return (
      <div key={bIdx} className="space-y-1">
        {renderBodyLines(block.split('\n'), `${bIdx}-mixed`)}
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
  activeBibleVersion = 'RV1909',
  dailyBreadData,
  onStartStudyFromVerse,
  onToggleMobileSidebar,
  onOpenWelcomeGuide,
  onOpenSettings,
  onCancelGeneration,
  activeBrainLabel,
  brainActivity = 'idle',
  dialogueMode = 'AUTO',
  onChangeDialogueMode,
  dialoguePhase = 'IDLE',
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showDailyBread, setShowDailyBread] = useState(true);
  const [isCrisisDismissed, setIsCrisisDismissed] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<MinistryFormat>('AUTO');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantId = chat?.mensajes.reduce<string | undefined>(
    (last, message) => (message.role === 'assistant' ? message.id : last),
    undefined
  );

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
    const formatForTurn = selectedFormat;
    setInputText('');
    // El formato elegido aplica solo a este turno; después vuelve a Auto.
    setSelectedFormat('AUTO');
    await onSendMessage(msg, formatForTurn);
  };

  const copyText = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-nocturne-950 overflow-hidden text-zinc-200 relative">
      {/* Barra Superior del Chat (Moderna y Despejada con resguardo para status bar móvil) */}
      <header className="px-3 sm:px-6 pt-[max(env(safe-area-inset-top,0px),1.85rem)] pb-2.5 sm:py-3 border-b border-nocturne-800 bg-nocturne-900/80 backdrop-blur-xl flex items-center justify-between z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                <span className="hidden sm:inline-block text-[9px] px-2 py-0.5 rounded-full bg-nocturne-800 text-sacred-gold font-mono border border-nocturne-700 shrink-0">
                  {chat.ruta_predominante.replace(/[[\]]/g, '')}
                </span>
              )}
            </h2>
            <p className="hidden md:block text-[11px] text-zinc-400 mt-0.5 truncate">
              Canon {activeBibleVersion || 'RV1909'} · {activeBrainLabel || 'Motor local determinista'}
              {brainActivity === 'loading' && ' · cargando cerebro…'}
              {brainActivity === 'prefill' && ' · procesando contexto…'}
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera: Plan Diario, Nivel Teológico y Ajustes */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Alternador de Plan Diario */}
          {dailyBreadData && (
            <button
              type="button"
              onClick={() => setShowDailyBread((prev) => !prev)}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs flex items-center gap-1 border transition-all cursor-pointer ${
                showDailyBread
                  ? 'bg-sacred-gold/20 border-sacred-gold/50 text-sacred-gold-light'
                  : 'bg-nocturne-900 border-nocturne-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={showDailyBread ? 'Ocultar Plan Diario' : 'Mostrar Plan Diario'}
            >
              <Sun className="w-3.5 h-3.5 text-sacred-gold shrink-0" />
              <span className="hidden xl:inline text-[11px] font-medium">Plan Diario</span>
            </button>
          )}

          {/* Selector de Nivel Teológico */}
          <LevelSelector currentLevel={currentLevel} onChange={onChangeLevel} />

          {/* Botón Centralizado de Ajustes */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-gradient-to-r from-nocturne-900 to-nocturne-850 hover:from-nocturne-850 hover:to-nocturne-800 border border-nocturne-800 hover:border-sacred-gold/40 text-zinc-300 hover:text-sacred-gold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Abrir panel de ajustes del sistema (Canon, Teología, Modelos, Voz)"
            >
              <Settings className="w-4 h-4 text-sacred-gold" />
              <span className="hidden sm:inline text-[11px] font-medium">Ajustes</span>
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

      {/* Feed de Mensajes con Scroll Independiente y Espacio para Cápsula Flotante */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pt-3 sm:pt-4 pb-64 sm:pb-52 space-y-4 sm:space-y-6">
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
                  Tu asistente bíblico y pastoral con memoria evolutiva, canon verificado y motor local
                  determinista. Puedes conectar un modelo propio (Ollama o LM Studio) sin cambiar el flujo.
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
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-zinc-900 border border-nocturne-800 hover:border-sacred-gold/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Estudiar el libro de Mateo"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('quiero estudiar la carta a los romanos')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-zinc-900 border border-nocturne-800 hover:border-sacred-gold/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Carta a los Romanos"
                    </button>
                  </div>
                </div>

                {/* 2. Consejería Pastoral */}
                <div className="p-3 rounded-xl bg-nocturne-900/70 border border-nocturne-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-emerald-700 font-semibold flex items-center gap-1">
                    🕊️ Consejería & Paz
                  </span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('tengo mucha ansiedad y miedo por mi futuro que dice la biblia')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-zinc-900 border border-nocturne-800 hover:border-emerald-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Ansiedad y miedo al futuro"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('xq dios permite q suframos tanto si nos ama?')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-zinc-900 border border-nocturne-800 hover:border-emerald-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "¿Por qué sufrimos?"
                    </button>
                  </div>
                </div>

                {/* 3. Exégesis y Raíces */}
                <div className="p-3 rounded-xl bg-nocturne-900/70 border border-nocturne-800 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-sky-700 font-semibold flex items-center gap-1">
                    🏛️ Exégesis & Raíces
                  </span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('analiza el significado exegetico de bara H1254 en genesis 1:1')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-zinc-900 border border-nocturne-800 hover:border-sky-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
                    >
                      "Raíz bará H1254 (Génesis 1:1)"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt('explicame el pacto abrahamico y su relacion con cristo')}
                      className="w-full p-2 rounded-lg bg-nocturne-950 hover:bg-nocturne-850 text-left text-[11px] text-zinc-300 hover:text-zinc-900 border border-nocturne-800 hover:border-sky-500/40 transition-colors block leading-tight active:scale-[0.99] cursor-pointer"
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
            // Solo afirmamos «Citas Exactas» cuando el turno trae citas
            // verificadas contra SQLite (o el bloque textual que añadimos
            // nosotros). Un modelo local puede responder sin citar nada; en
            // ese caso el distintivo debe ser honesto y no un sello vacío.
            const hasVerifiedCitations =
              (msg.citations?.length ?? 0) > 0 ||
              msg.content.includes('Texto bíblico verificado');

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
                    {renderMessageContent(msg.content, (actionLabel) => onSendMessage(actionLabel, 'AUTO'))}
                  </div>

                  {/* Acciones de Mensaje (Copiar / Fijar a Estudio / Voz) */}
                  {!isUser && (
                    <div className="mt-2.5 pt-2 border-t border-nocturne-800 flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        {hasVerifiedCitations ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-mono text-[9px] sm:text-[10px]">
                              Citas Exactas {activeBibleVersion || 'RV1909'}
                            </span>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="font-mono text-[9px] sm:text-[10px] text-zinc-500">
                              Sin citas verificadas
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {msg.id === lastAssistantId && msg.truncated && (
                          <button
                            type="button"
                            disabled={isGenerating}
                            onClick={() => onSendMessage('continúa', 'AUTO')}
                            className="flex items-center gap-1 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-lg bg-sacred-gold/15 hover:bg-sacred-gold/25 text-sacred-gold border border-sacred-gold/40 transition-all text-[11px] sm:text-[11px] cursor-pointer touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Continuar esta respuesta desde donde se cortó"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>Ampliar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSpeak(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-lg transition-all text-[11px] sm:text-[11px] cursor-pointer touch-manipulation active:scale-95 ${
                            playingMessageId === msg.id
                              ? 'bg-rose-950/90 text-rose-300 border border-rose-500/50 shadow-sm'
                              : 'bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-sacred-gold border border-nocturne-750'
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
                          className="flex items-center gap-1 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-lg bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-sacred-gold transition-all text-[11px] sm:text-[11px] cursor-pointer touch-manipulation active:scale-95 border border-nocturne-750"
                          title="Fijar en Pizarra de Estudio"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          <span>Fijar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyText(msg.id, msg.content)}
                          className="flex items-center gap-1 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-lg bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-zinc-900 transition-all text-[11px] sm:text-[11px] cursor-pointer touch-manipulation active:scale-95 border border-nocturne-750"
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
        {isGenerating && !streamingText && (
          <div className="flex flex-col items-start smooth-gpu">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-mono text-zinc-400">
                VerboVivo ({brainActivity === 'loading' ? 'cargando cerebro local...' : brainActivity === 'prefill' ? 'procesando contexto...' : 'preparando respuesta...'})
              </span>
            </div>
            <div className="relative max-w-[92%] sm:max-w-2xl p-3 sm:p-4 rounded-2xl rounded-tl-none bg-nocturne-900 text-zinc-300 border border-sacred-gold/30 text-xs sm:text-sm shadow-sm">
              <div className="flex items-start gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-sacred-gold shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  {brainActivity === 'loading'
                    ? 'Cargando el modelo GGUF en este dispositivo. La primera vez puede tardar un minuto; después la conversación es más rápida.'
                    : brainActivity === 'prefill'
                      ? `Procesando el contexto bíblico en el dispositivo${activeBrainLabel?.includes('nativo') ? ' con llama.cpp nativo' : ' con el motor GGUF local'}. Esta etapa y la respuesta pueden tardar según el modelo y el equipo; puedes cancelar cuando quieras.`
                      : 'Preparando la respuesta con el texto bíblico verificado...'}
                </span>
              </div>
            </div>
          </div>
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

      {/* Cápsula Flotante de Entrada de Texto (Diseño Moderno Glassmorphic Transparent) */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 pointer-events-none z-20">
        <div className="max-w-3xl mx-auto space-y-2 pointer-events-auto">
          {/* Telemetría del Escudo Limpiador y RAG Híbrido en Tiempo Real (visible en pantallas medianas/grandes, oculto en móvil para no tapar contenido) */}
          {lastShieldResult && (
            <div className="hidden sm:flex px-3.5 py-1.5 bg-nocturne-900/80 backdrop-blur-xl rounded-2xl border border-nocturne-800 flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] text-zinc-400 font-mono shadow-lg">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <Zap className="w-3 h-3 text-sacred-gold" />
                <span>Escudo: {lastShieldResult.processingTimeMs} ms</span>
                <span className="text-zinc-600">|</span>
                <span>RAG Híbrido: {ragVersesCount} citas</span>
                <span className="text-zinc-600">|</span>
                <span className="text-sacred-gold-light">Ruta: {lastShieldResult.detectedRoute}</span>
              </div>
              {lastShieldResult.normalizedText !== lastShieldResult.originalText && (
                <div className="truncate max-w-[200px] sm:max-w-xs text-zinc-400" title={lastShieldResult.normalizedText}>
                  Norm: "{lastShieldResult.normalizedText}"
                </div>
              )}
            </div>
          )}

          {/* Caja Flotante de Vidrio con Formatos Ministeriales y Área de Escritura */}
          <div className={`bg-nocturne-900/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-nocturne-800 shadow-2xl p-2.5 sm:p-3 transition-all ${LEVEL_ACCENTS[currentLevel]?.focusClass || 'focus-within:border-sacred-gold/50'}`}>
            {/* Selector de Modo de Diálogo: Auto, Consulta, Estudio, Consejería o Documento */}
            {onChangeDialogueMode && (
              <div className="flex items-center gap-2 px-1 pb-1.5">
                <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 shrink-0">
                  Modo
                </span>
                <select
                  value={dialogueMode}
                  onChange={(e) => onChangeDialogueMode(e.target.value as DialogueMode)}
                  className="bg-nocturne-850 border border-nocturne-800 hover:border-sacred-gold/40 rounded-lg text-[10px] sm:text-[11px] px-2 py-1 text-zinc-200 focus:outline-none focus:border-sacred-gold/60 cursor-pointer"
                  title="Define cómo debe responder VerboVivo en este chat"
                >
                  {DIALOGUE_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id} className="bg-nocturne-900 text-zinc-200">
                      {mode.label}
                    </option>
                  ))}
                </select>
                {dialoguePhase !== 'IDLE' && PHASE_LABELS[dialoguePhase] && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sacred-gold/10 text-sacred-gold border border-sacred-gold/30 font-mono shrink-0">
                    {PHASE_LABELS[dialoguePhase]}
                  </span>
                )}
                <span className="ml-auto hidden sm:inline text-[9px] text-zinc-500 truncate">
                  {DIALOGUE_MODES.find((mode) => mode.id === dialogueMode)?.title}
                </span>
              </div>
            )}

            {/* Selector Rápido de Formatos Ministeriales (aplica solo al siguiente mensaje) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[11px] px-1">
              {FORMAT_PILLS.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedFormat(pill.id)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all border font-medium flex items-center gap-1 cursor-pointer text-[10px] sm:text-[11px] ${
                    selectedFormat === pill.id
                      ? 'bg-sacred-gold text-nocturne-950 border-sacred-gold shadow-sm font-semibold'
                      : 'bg-nocturne-850/80 text-zinc-400 hover:text-zinc-100 border-nocturne-800 hover:bg-nocturne-800'
                  }`}
                >
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            {/* Formulario y Campo de Texto */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
              <div className="relative">
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
                  placeholder={`Escribe tu consulta en lenguaje cotidiano (Nivel ${currentLevel})...`}
                  className="w-full px-2.5 py-1.5 bg-transparent text-xs sm:text-sm text-parchment-100 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed font-sans max-h-36 overflow-y-auto"
                />
              </div>

              {/* Barra Inferior de la Cápsula: Canon, Nivel Armonizado y Botón de Enviar */}
              <div className="flex items-center justify-between pt-1.5 border-t border-nocturne-800/80 px-1">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-sans">
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-nocturne-850 hover:bg-nocturne-800 text-zinc-400 hover:text-sacred-gold border border-nocturne-800 transition-colors cursor-pointer"
                      title="Configurar Canon Bíblico y Módulos"
                    >
                      <BookOpen className="w-3 h-3 text-sacred-gold" />
                      <span className="font-medium">{activeBibleVersion || 'RV1909'}</span>
                    </button>
                  )}
                  <span className="hidden sm:inline-block text-zinc-400">·</span>
                  <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${LEVEL_ACCENTS[currentLevel]?.pillClass || ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_ACCENTS[currentLevel]?.dotClass || 'bg-sacred-gold'}`} />
                    <span>Nivel {currentLevel}</span>
                  </span>
                </div>

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={onCancelGeneration}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/50 font-bold shadow-md transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                    title="Detener la generación en curso"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline text-xs font-semibold">Detener</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className={`px-3 py-1.5 rounded-xl bg-gradient-to-r from-sacred-gold to-sacred-gold-light text-nocturne-950 font-bold shadow-md transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                      !inputText.trim()
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:scale-105 active:scale-95 cursor-pointer shadow-sacred-gold/20'
                    }`}
                    title="Enviar consulta"
                  >
                    <span className="hidden sm:inline text-xs font-semibold">Consultar</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
