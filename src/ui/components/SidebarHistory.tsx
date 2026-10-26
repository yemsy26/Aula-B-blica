import React from 'react';
import { ChatRecord, UserEvolutionProfile } from '../../core/database/usuarioMemoriaService.js';
import {
  MessageSquare,
  Plus,
  Pin,
  Trash2,
  BrainCircuit,
  Database,
  Download,
  BookOpen,
  Sparkles,
  X,
  HelpCircle,
} from 'lucide-react';

interface SidebarHistoryProps {
  chats: ChatRecord[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onTogglePinChat: (chatId: string) => void;
  userProfile: UserEvolutionProfile;
  onExportBackup: () => void;
  activeTab: 'chat' | 'whiteboard' | 'strong';
  onSelectTab: (tab: 'chat' | 'whiteboard' | 'strong') => void;
  onOpenModelManager?: () => void;
  activeModelName?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenWelcomeGuide?: () => void;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  chats,
  activeChatId,
  onSelectChat,
  onCreateNewChat,
  onDeleteChat,
  onTogglePinChat,
  userProfile,
  onExportBackup,
  activeTab,
  onSelectTab,
  onOpenModelManager,
  activeModelName = 'Edge Micro (Offline)',
  isOpenMobile = false,
  onCloseMobile,
  onOpenWelcomeGuide,
}) => {
  const handleSelectChatSafe = (chatId: string) => {
    onSelectChat(chatId);
    if (onCloseMobile) onCloseMobile();
  };

  const handleCreateNewChatSafe = () => {
    onCreateNewChat();
    if (onCloseMobile) onCloseMobile();
  };

  const handleSelectTabSafe = (tab: 'chat' | 'whiteboard' | 'strong') => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Overlay Backdrop para móviles */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] h-full flex flex-col bg-nocturne-900 border-r border-nocturne-800 text-zinc-300 select-none shadow-2xl transition-transform duration-200 md:static md:w-80 md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isOpenMobile ? 'flex' : 'hidden md:flex'}`}
      >
        {/* Cabecera de la Marca & Nuevo Chat */}
        <div className="p-4 border-b border-nocturne-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sacred-gold/20 border border-sacred-gold/40 flex items-center justify-center text-sacred-gold font-serif font-bold text-base shadow-sm">
                ✝
              </div>
              <div>
                <h1 className="font-serif font-bold text-sm tracking-wide text-parchment-100 leading-none">
                  VerboVivo
                </h1>
                <p className="text-[10px] text-zinc-400 font-mono tracking-tight mt-0.5">
                  100% Offline · RV1909
                </p>
              </div>
            </div>

            {/* Botón Cerrar en móvil */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-nocturne-800 transition-colors md:hidden"
                title="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Pestañas de Navegación de la Shell */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-nocturne-950/80 rounded-xl border border-nocturne-800 text-xs">
            <button
              onClick={() => handleSelectTabSafe('chat')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-nocturne-800 text-sacred-gold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => handleSelectTabSafe('whiteboard')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'whiteboard'
                  ? 'bg-nocturne-800 text-sacred-gold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Pizarra</span>
            </button>
            <button
              onClick={() => handleSelectTabSafe('strong')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'strong'
                  ? 'bg-nocturne-800 text-sacred-gold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Strong</span>
            </button>
          </div>

          {/* Botón Nueva Consulta */}
          <button
            onClick={handleCreateNewChatSafe}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-sacred-gold/15 hover:bg-sacred-gold/25 text-sacred-gold-light border border-sacred-gold/30 font-medium text-xs transition-all duration-200 smooth-gpu shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Consulta Bíblica</span>
          </button>
        </div>

      {/* Lista de Conversaciones Históricas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
          <span>Historial de Chats</span>
          <span className="text-[10px] font-mono text-zinc-400">{chats.length}</span>
        </div>

        {chats.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-400">
            No hay conversaciones activas. Inicia una nueva consulta.
          </div>
        ) : (
          chats.map((chat) => {
            const isSelected = chat.id === activeChatId;

            return (
              <div
                key={chat.id}
                onClick={() => handleSelectChatSafe(chat.id)}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
                  isSelected
                    ? 'bg-nocturne-800/90 text-parchment-100 border-sacred-gold/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-nocturne-850 border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    {chat.fijado && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                    <p className="text-xs font-medium truncate leading-snug">
                      {chat.titulo || 'Consulta sin título'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-nocturne-950/70 border border-nocturne-800 text-zinc-400 font-mono">
                      {chat.ruta_predominante.replace(/[[\]]/g, '')}
                    </span>
                    <span className="text-[9px] text-zinc-400">
                      {chat.nivel_teologico}
                    </span>
                  </div>
                </div>

                <div className="opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePinChat(chat.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-amber-400 active:text-amber-300 rounded transition-colors"
                    title={chat.fijado ? 'Desfijar' : 'Fijar'}
                  >
                    <Pin className={`w-3.5 h-3.5 ${chat.fijado ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-rose-400 active:text-rose-300 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Ficha Maestra de Memoria Global Evolutiva */}
      <div className="p-3 border-t border-nocturne-800 bg-nocturne-950/90">
        <div className="p-3 rounded-xl bg-nocturne-900 border border-nocturne-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sacred-gold-light">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Memoria Evolutiva</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              {userProfile.nivel_espiritual}
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 leading-tight">
            {userProfile.resumen_madurez}
          </p>

          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-zinc-400">
            <div className="bg-nocturne-950/80 p-1.5 rounded border border-nocturne-800">
              <span className="block text-zinc-400">Temas</span>
              <strong className="text-zinc-200">{userProfile.temas_estudiados.length} tratados</strong>
            </div>
            <div className="bg-nocturne-950/80 p-1.5 rounded border border-nocturne-800">
              <span className="block text-zinc-400">Dudas</span>
              <strong className="text-zinc-200">
                {userProfile.dudas_pendientes.filter((d) => !d.resuelta).length} pendientes
              </strong>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-400 border-t border-nocturne-800">
            <button
              onClick={() => {
                onOpenModelManager?.();
                onCloseMobile?.();
              }}
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
              title="Gestionar modelo On-Device GGUF"
            >
              <Database className="w-3 h-3 text-emerald-400" />
              <span className="truncate max-w-[85px]">{activeModelName}</span>
            </button>

            <div className="flex items-center gap-2">
              {onOpenWelcomeGuide && (
                <button
                  onClick={() => {
                    onOpenWelcomeGuide();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="flex items-center gap-1 text-zinc-400 hover:text-sacred-gold transition-colors"
                  title="Abrir Guía de Bienvenida"
                >
                  <HelpCircle className="w-3 h-3 text-sacred-gold" />
                  <span>Guía</span>
                </button>
              )}
              <button
                onClick={onExportBackup}
                className="flex items-center gap-1 text-sacred-gold hover:underline"
                title="Descargar backup JSON"
              >
                <Download className="w-3 h-3" />
                <span>Backup</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};
