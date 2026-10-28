import React, { useState } from 'react';
import {
  X,
  Settings,
  BookOpen,
  Volume2,
  Cpu,
  BrainCircuit,
  Download,
  HelpCircle,
  Check,
  FileUp,
  Sprout,
  Scroll,
  BookMarked,
  ShieldCheck,
} from 'lucide-react';
import { UserTheologicalLevel } from '../../core/shield/types.js';
import { UserEvolutionProfile } from '../../core/database/usuarioMemoriaService.js';
import { offlineTts } from '../../core/tts/offlineTtsService.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: UserTheologicalLevel;
  onChangeLevel: (level: UserTheologicalLevel) => void;
  activeBibleVersion: string;
  availableVersions: string[];
  onSelectBibleVersion: (version: string) => void;
  onOpenBibleImporter: () => void;
  onOpenModelManager: () => void;
  activeModelName: string;
  userProfile?: UserEvolutionProfile;
  onExportBackup: () => void;
  onOpenWelcomeGuide: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentLevel,
  onChangeLevel,
  activeBibleVersion,
  availableVersions,
  onSelectBibleVersion,
  onOpenBibleImporter,
  onOpenModelManager,
  activeModelName,
  userProfile,
  onExportBackup,
  onOpenWelcomeGuide,
}) => {
  const [activeTab, setActiveTab] = useState<'theology' | 'voice' | 'brain' | 'memory'>('theology');

  if (!isOpen) return null;

  const ttsState = offlineTts.getState();
  const availableVoices = offlineTts.getVoices();
  const activeVoice = availableVoices.find(
    (v) => v.name === ttsState.selectedVoiceName || v.voiceURI === ttsState.selectedVoiceName
  );
  const activeVoiceLabel = activeVoice?.displayName || activeVoice?.name || 'Voz del sistema';

  const LEVELS: {
    id: UserTheologicalLevel;
    label: string;
    subtitle: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    selectedClass: string;
    titleClass: string;
    iconClass: string;
  }[] = [
    {
      id: 'Semilla',
      label: 'Semilla',
      subtitle: 'Básico · Gracia y Vida',
      desc: 'Respuestas directas con lenguaje cálido, ilustraciones cotidianas y aplicaciones prácticas para el creyente.',
      icon: Sprout,
      selectedClass: 'border-emerald-500/60 bg-emerald-50 shadow-sm shadow-emerald-500/10',
      titleClass: 'text-emerald-800 font-bold',
      iconClass: 'text-emerald-700',
    },
    {
      id: 'Discipulo',
      label: 'Discípulo',
      subtitle: 'Intermedio · Verdad Celestial',
      desc: 'Análisis del contexto cultural, geográfico, cronología bíblica y conexiones doctrinales intertextuales.',
      icon: Scroll,
      selectedClass: 'border-sky-500/60 bg-sky-50 shadow-sm shadow-sky-500/10',
      titleClass: 'text-sky-900 font-bold',
      iconClass: 'text-sky-700',
    },
    {
      id: 'Maestro',
      label: 'Maestro',
      subtitle: 'Profundo · Gloria Shejiná',
      desc: 'Exégesis de alta precisión con raíces en Hebreo y Griego Koiné (Strong), sintaxis original e historia de la redención.',
      icon: BookMarked,
      selectedClass: 'border-amber-500/60 bg-amber-50 shadow-sm shadow-amber-500/10',
      titleClass: 'text-amber-950 font-bold',
      iconClass: 'text-amber-800',
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-nocturne-900 border border-nocturne-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-200">
        
        {/* Cabecera del Panel de Ajustes */}
        <div className="p-4 sm:p-5 border-b border-nocturne-800 flex items-center justify-between bg-nocturne-950/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sacred-gold/15 border border-sacred-gold/30 flex items-center justify-center text-sacred-gold shadow-sm">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-parchment-100 flex items-center gap-2">
                <span>Ajustes y Configuración</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sacred-gold/15 text-sacred-gold border border-sacred-gold/30 font-mono">
                  VerboVivo
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Personaliza tu nivel teológico, traducción activa y motores offline
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-nocturne-800 transition-colors cursor-pointer"
            title="Cerrar ajustes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Navegación de Ajustes */}
        <div className="grid grid-cols-4 border-b border-nocturne-800 bg-nocturne-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('theology')}
            className={`py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'theology'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/60 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Teología</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'voice'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/60 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Voz y Audio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('brain')}
            className={`py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'brain'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/60 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Cerebro AI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`py-3 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'memory'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/60 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Memoria</span>
          </button>
        </div>

        {/* Contenedor de Opciones Desplazable */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 text-xs sm:text-sm">
          
          {/* TAB 1: TEOLOGÍA & CANON */}
          {activeTab === 'theology' && (
            <div className="space-y-5">
              {/* Sección A: Nivel Teológico y Combinación Armónica */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-sacred-gold uppercase font-mono tracking-wider">
                  Nivel de Exégesis y Armonía Ministerial
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {LEVELS.map((lvl) => {
                    const Icon = lvl.icon;
                    const isSelected = currentLevel === lvl.id;
                    return (
                      <div
                        key={lvl.id}
                        onClick={() => onChangeLevel(lvl.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? `${lvl.selectedClass} shadow-md`
                            : 'bg-nocturne-950/60 border-nocturne-800 hover:border-nocturne-700 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className={`flex items-center gap-1.5 font-bold text-xs ${isSelected ? lvl.titleClass : 'text-zinc-200'}`}>
                            <Icon className={`w-4 h-4 ${isSelected ? lvl.iconClass : 'text-sacred-gold'}`} />
                            <span>{lvl.label}</span>
                          </div>
                          {isSelected && <Check className={`w-4 h-4 ${lvl.iconClass}`} />}
                        </div>
                        <span className="block text-[9px] font-medium font-mono text-zinc-400 mb-1">
                          {lvl.subtitle}
                        </span>
                        <p className="text-[10px] text-zinc-400 leading-snug">
                          {lvl.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sección B: Traducción Bíblica y Módulos */}
              <div className="space-y-2.5 pt-2 border-t border-nocturne-800">
                <label className="block text-xs font-semibold text-sacred-gold uppercase font-mono tracking-wider">
                  Traducción Bíblica Activa (Canon)
                </label>
                <div className="p-4 rounded-2xl bg-nocturne-950/80 border border-nocturne-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-parchment-100">
                        Versión Activa para Citas y Concordancias
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Inyección determinista inmutable con 0% de alteración textual.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={activeBibleVersion}
                        onChange={(e) => onSelectBibleVersion(e.target.value)}
                        className="bg-nocturne-900 border border-nocturne-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-sacred-gold focus:outline-none focus:border-sacred-gold cursor-pointer"
                      >
                        {availableVersions.map((v) => (
                          <option key={v} value={v} className="bg-nocturne-900 text-zinc-200">
                            {v}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          onOpenBibleImporter();
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sacred-gold/15 hover:bg-sacred-gold/25 text-sacred-gold border border-sacred-gold/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
                        title="Abrir Catálogo de Descargas y Módulos"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Módulos (1 Clic)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-nocturne-900/60 p-2.5 rounded-xl border border-nocturne-850">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Actualmente tienes <strong>{availableVersions.length}</strong> traducción(es) lista(s) para usar de forma local y offline.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VOZ Y AUDIO */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sacred-gold uppercase font-mono tracking-wider mb-2">
                  Motor de Síntesis de Voz (TTS)
                </label>
                <div className="p-4 rounded-2xl bg-nocturne-950/80 border border-nocturne-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-parchment-100">
                        Prosodia y Lectura Pastoral Adaptativa
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Segmenta automáticamente títulos, versículos canónicos y aplicaciones con pausas reverentes.
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono">
                      Activo
                    </span>
                  </div>

                  <div className="pt-2 border-t border-nocturne-850 flex items-center justify-between gap-3 text-xs text-zinc-300">
                    <span className="shrink-0">Voz activa:</span>
                    <strong className="text-sacred-gold font-mono text-right truncate">
                      {activeVoiceLabel}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs text-zinc-300">
                    <span>Voces en español instaladas:</span>
                    <strong className="text-parchment-100 font-mono">
                      {availableVoices.length}
                    </strong>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed bg-nocturne-900/60 p-2.5 rounded-xl border border-nocturne-850">
                    💡 Durante la reproducción de cualquier mensaje bíblico, puedes cambiar la voz o pausar la lectura desde la barra flotante de audio. Solo se muestran las voces que el sistema Android tiene instaladas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CEREBRO AI & MODELOS */}
          {activeTab === 'brain' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sacred-gold uppercase font-mono tracking-wider mb-2">
                  Motor de Inferencia On-Device
                </label>
                <div className="p-4 rounded-2xl bg-nocturne-950/80 border border-nocturne-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-parchment-100">
                        Modelo Activo: {activeModelName}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Ejecución en cliente sin servidores remotos ni telemetría.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenModelManager();
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sacred-gold/15 hover:bg-sacred-gold/25 text-sacred-gold border border-sacred-gold/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
                    >
                      Gestionar Modelos
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-nocturne-900/80 border border-nocturne-800">
                      <span className="block text-zinc-400">Modo Predeterminado:</span>
                      <strong className="text-zinc-200">Compositor Determinista</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-nocturne-900/80 border border-nocturne-800">
                      <span className="block text-zinc-400">Compatibilidad RAM:</span>
                      <strong className="text-emerald-400">Desde 2 GB RAM</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEMORIA & RESPALDO */}
          {activeTab === 'memory' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sacred-gold uppercase font-mono tracking-wider mb-2">
                  Memoria Evolutiva y Respaldo de Datos
                </label>
                <div className="p-4 rounded-2xl bg-nocturne-950/80 border border-nocturne-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-parchment-100">
                        Perfil Espiritual: {userProfile?.nivel_espiritual || 'Discípulo'}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {userProfile?.resumen_madurez || 'Compresión de memoria activa.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={onExportBackup}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sacred-gold/15 hover:bg-sacred-gold/25 text-sacred-gold border border-sacred-gold/30 text-xs font-medium transition-all cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Backup</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-nocturne-850 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">
                      ¿Necesitas un recorrido por el sistema?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenWelcomeGuide();
                        onClose();
                      }}
                      className="text-xs text-sacred-gold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Ver Guía de Bienvenida</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div className="p-3 sm:p-4 border-t border-nocturne-800 bg-nocturne-950/90 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-mono text-[11px]">
            VerboVivo v1.0.0 · Motor local y conexión opcional
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sacred-gold text-nocturne-950 font-semibold hover:bg-sacred-gold-light transition-all cursor-pointer"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};
