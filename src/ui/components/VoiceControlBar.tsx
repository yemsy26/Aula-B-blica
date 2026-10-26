import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Sparkles,
  Cpu,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import { offlineTts } from '../../core/tts/offlineTtsService.js';
import { TtsState, RankedVoiceOption } from '../../core/tts/index.js';
import { piperNeuralTts, PiperModelConfig } from '../../core/tts/piperNeuralTtsAdapter.js';

export const VoiceControlBar: React.FC = () => {
  const [ttsState, setTtsState] = useState<TtsState>(offlineTts.getState());
  const [rankedVoices, setRankedVoices] = useState<RankedVoiceOption[]>([]);
  const [piperModels, setPiperModels] = useState<PiperModelConfig[]>([]);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [piperDownloadProgress, setPiperDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = offlineTts.subscribe((newState) => {
      setTtsState(newState);
    });

    const updateVoices = () => {
      setRankedVoices(offlineTts.getVoices());
      setPiperModels(piperNeuralTts.getAvailableModels());
    };

    updateVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Si no está sonando ni pausado, no mostramos la barra flotante
  if (!ttsState.isPlaying && !ttsState.isPaused) {
    return null;
  }

  const handleSelectVoice = (voiceName: string) => {
    offlineTts.setEngineMode('SYSTEM_NEURAL');
    offlineTts.setVoice(voiceName);
    setIsVoiceMenuOpen(false);
  };

  const handleSelectPiperModel = async (model: PiperModelConfig) => {
    if (!model.isDownloaded) {
      setPiperDownloadProgress(10);
      await piperNeuralTts.downloadAndLoad(model.id, (p) => {
        setPiperDownloadProgress(p);
      });
      setPiperDownloadProgress(null);
      setPiperModels(piperNeuralTts.getAvailableModels());
    } else {
      piperNeuralTts.setActiveModelId(model.id);
    }
    offlineTts.setEngineMode('PIPER_HD_OFFLINE');

    // Mapear automáticamente a una voz adecuada de la región (Latinoamérica o España)
    const isLatam = model.id.startsWith('es_MX');
    const matchingVoice =
      rankedVoices.find((v) => {
        const langLower = (v.lang || '').toLowerCase().replace('_', '-');
        if (isLatam) {
          return langLower.includes('mx') || langLower.includes('us') || langLower.includes('419');
        }
        return langLower.includes('es');
      }) || rankedVoices[0];

    if (matchingVoice) {
      offlineTts.setVoice(matchingVoice.name);
    }

    setIsVoiceMenuOpen(false);
  };

  const currentVoiceObj = rankedVoices.find(
    (v) => v.name === ttsState.selectedVoiceName || v.displayName === ttsState.selectedVoiceName
  );

  return (
    <>
      <div className="fixed bottom-36 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-nocturne-900/95 border border-sacred-gold/40 rounded-2xl shadow-2xl backdrop-blur-md text-zinc-200 p-2.5 sm:p-3.5 transition-all animate-in slide-in-from-bottom-3 duration-200">
        <div className="flex flex-col gap-2">
          {/* Fila Superior: Estado del Segmento y Onda Visual */}
          <div className="flex items-center justify-between gap-2 border-b border-nocturne-800 pb-2">
            {/* Onda de Voz Dinámica (60 FPS CSS) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-end gap-1 h-5 px-1.5 py-0.5 rounded bg-nocturne-950 border border-nocturne-800 shrink-0">
                <span
                  className={`w-1 bg-sacred-gold rounded-full transition-all duration-150 ${
                    ttsState.isPlaying && !ttsState.isPaused
                      ? 'h-4 animate-pulse'
                      : 'h-1.5 opacity-50'
                  }`}
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className={`w-1 bg-sacred-gold rounded-full transition-all duration-150 ${
                    ttsState.isPlaying && !ttsState.isPaused
                      ? 'h-5 animate-pulse'
                      : 'h-2 opacity-50'
                  }`}
                  style={{ animationDelay: '120ms' }}
                />
                <span
                  className={`w-1 bg-sacred-gold rounded-full transition-all duration-150 ${
                    ttsState.isPlaying && !ttsState.isPaused
                      ? 'h-3 animate-pulse'
                      : 'h-1 opacity-50'
                  }`}
                  style={{ animationDelay: '240ms' }}
                />
                <span
                  className={`w-1 bg-sacred-gold rounded-full transition-all duration-150 ${
                    ttsState.isPlaying && !ttsState.isPaused
                      ? 'h-4 animate-pulse'
                      : 'h-2 opacity-50'
                  }`}
                  style={{ animationDelay: '80ms' }}
                />
              </div>

              {/* Identificador de tipo de contenido */}
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 text-sacred-gold">
                  {ttsState.currentChunkKind === 'verse' ? (
                    <>
                      <Sparkles className="w-3 h-3 text-sacred-gold animate-spin" />
                      Pasaje Bíblico Reverente
                    </>
                  ) : ttsState.currentChunkKind === 'title' ? (
                    <>📑 Encabezado de Estudio</>
                  ) : (
                    <>📖 Narrativa Pastoral</>
                  )}
                  {ttsState.totalChunks > 1 && (
                    <span className="text-zinc-400 font-mono text-[9px] ml-1">
                      ({ttsState.currentChunkIndex + 1}/{ttsState.totalChunks})
                    </span>
                  )}
                </span>
                <p className="text-xs text-zinc-300 truncate max-w-xs sm:max-w-md italic">
                  «{ttsState.currentUtteranceText || 'Leyendo...'}»
                </p>
              </div>
            </div>

            {/* Botón Detener / Cerrar */}
            <button
              onClick={() => offlineTts.stop()}
              title="Detener audio"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>

          {/* Fila Inferior: Controles de Reproducción y Selectores Adaptados */}
          <div className="flex items-center justify-between gap-1.5">
            {/* Controles de Transporte (Anterior, Pausa/Play, Siguiente, Parar) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => offlineTts.previousChunk()}
                title="Segmento anterior"
                className="p-1.5 rounded-lg bg-nocturne-950 text-zinc-300 hover:text-zinc-900 hover:bg-nocturne-800 transition-colors"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              {ttsState.isPaused ? (
                <button
                  onClick={() => offlineTts.resume()}
                  title="Reanudar locución"
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-sacred-gold text-nocturne-950 font-bold text-xs flex items-center gap-1 shadow-md hover:bg-sacred-gold/90 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden xs:inline">Reanudar</span>
                </button>
              ) : (
                <button
                  onClick={() => offlineTts.pause()}
                  title="Pausar locución"
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-nocturne-950 border border-sacred-gold/40 text-sacred-gold font-bold text-xs flex items-center gap-1 hover:bg-sacred-gold/20 transition-all"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Pausar</span>
                </button>
              )}

              <button
                onClick={() => offlineTts.nextChunk()}
                title="Segmento siguiente"
                className="p-1.5 rounded-lg bg-nocturne-950 text-zinc-300 hover:text-zinc-900 hover:bg-nocturne-800 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => offlineTts.stop()}
                title="Detener por completo"
                className="p-1.5 rounded-lg bg-nocturne-950 text-zinc-400 hover:text-rose-400 hover:bg-nocturne-800 transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </div>

            {/* Grupo Derecho: Selector de Velocidad Compacto + Botón de Voz */}
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Selector de Velocidad */}
              <div className="flex items-center bg-nocturne-950 p-0.5 rounded-xl border border-nocturne-800 shrink-0">
                <button
                  onClick={() => offlineTts.setRate(0.85)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    Math.abs(ttsState.rate - 0.85) < 0.05
                      ? 'bg-sacred-gold text-nocturne-950 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  0.85x
                </button>
                <button
                  onClick={() => offlineTts.setRate(1.0)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    Math.abs(ttsState.rate - 1.0) < 0.05
                      ? 'bg-sacred-gold text-nocturne-950 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  1.0x
                </button>
                <button
                  onClick={() => offlineTts.setRate(1.2)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    Math.abs(ttsState.rate - 1.2) < 0.05
                      ? 'bg-sacred-gold text-nocturne-950 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  1.2x
                </button>
              </div>

              {/* Botón para Abrir Menú Modal de Voces */}
              <button
                onClick={() => setIsVoiceMenuOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-nocturne-950 border border-nocturne-800 text-[11px] text-zinc-300 hover:border-sacred-gold/40 transition-colors shrink-0 max-w-[125px] sm:max-w-[170px]"
              >
                {ttsState.activeEngineMode === 'PIPER_HD_OFFLINE' ? (
                  <>
                    <Cpu className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="truncate">Piper Neural</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3 text-sacred-gold shrink-0" />
                    <span className="truncate">
                      {currentVoiceObj?.displayName || currentVoiceObj?.name || 'Voz Neural'}
                    </span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Bottom Sheet para Selección de Voz Adaptativo a Móvil */}
      {isVoiceMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsVoiceMenuOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg bg-nocturne-900 border-t sm:border border-sacred-gold/40 rounded-t-3xl sm:rounded-2xl shadow-2xl p-4 sm:p-5 max-h-[82vh] flex flex-col animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de arrastre móvil */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden" />

            {/* Encabezado */}
            <div className="flex items-center justify-between pb-3 border-b border-nocturne-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sacred-gold/15 border border-sacred-gold/30 flex items-center justify-center text-sacred-gold">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-parchment-100">
                    Seleccionar Voz de Lectura
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Timbres naturales y modelos adaptados a la lectura bíblica
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVoiceMenuOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-parchment-100 hover:bg-nocturne-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista scrolleable de opciones */}
            <div className="overflow-y-auto flex-1 py-3 space-y-4 pr-1">
              {/* Sección 1: Voces del Sistema / Android */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sacred-gold font-semibold flex items-center gap-1.5 px-1 mb-2">
                  <Sparkles className="w-3 h-3 text-sacred-gold" />
                  Voces Naturales del Dispositivo ({rankedVoices.length})
                </span>
                <div className="space-y-1.5">
                  {rankedVoices.length > 0 ? (
                    rankedVoices.map((v) => {
                      const isSelected =
                        ttsState.activeEngineMode === 'SYSTEM_NEURAL' &&
                        (ttsState.selectedVoiceName === v.name ||
                          ttsState.selectedVoiceName === v.displayName);
                      return (
                        <button
                          key={v.name}
                          onClick={() => handleSelectVoice(v.name)}
                          className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isSelected
                              ? 'bg-sacred-gold/15 border-sacred-gold/60 text-sacred-gold shadow-md'
                              : 'bg-nocturne-950/70 border-nocturne-800/80 text-zinc-200 hover:bg-nocturne-800/60'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs truncate flex items-center gap-2">
                              <span>{v.displayName || v.name}</span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-sacred-gold text-nocturne-950 font-bold uppercase">
                                  Activa
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2">
                              <span className="font-mono">{v.lang}</span>
                              <span>•</span>
                              <span>{v.tierLabel || 'Estándar'}</span>
                            </div>
                          </div>
                          <Check
                            className={`w-4 h-4 shrink-0 transition-opacity ${
                              isSelected ? 'opacity-100 text-sacred-gold' : 'opacity-0'
                            }`}
                          />
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 rounded-xl bg-nocturne-950 text-center text-xs text-zinc-400">
                      Voz estándar del sistema configurada automáticamente.
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 2: Modelos Neurales Offline Piper */}
              <div className="pt-2 border-t border-nocturne-800">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5 px-1 mb-2">
                  <Cpu className="w-3 h-3 text-sky-400" />
                  Estudio Neural Offline Piper (~35 MB)
                </span>
                <div className="space-y-1.5">
                  {piperModels.map((pm) => {
                    const isSelected =
                      ttsState.activeEngineMode === 'PIPER_HD_OFFLINE' &&
                      piperNeuralTts.getActiveModelId() === pm.id;
                    return (
                      <button
                        key={pm.id}
                        onClick={() => handleSelectPiperModel(pm)}
                        disabled={piperDownloadProgress !== null}
                        className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-400/60 text-sky-300 shadow-md'
                            : 'bg-nocturne-950/70 border-nocturne-800/80 text-zinc-200 hover:bg-nocturne-800/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs truncate flex items-center gap-2">
                            <span>{pm.name}</span>
                            {isSelected && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-400 text-nocturne-950 font-bold uppercase">
                                Activo
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                            {pm.description}
                          </p>
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-lg font-mono shrink-0 bg-sky-950 text-sky-300 border border-sky-800/40">
                          {pm.isDownloaded ? 'Listo' : 'Descargar'}
                        </span>
                      </button>
                    );
                  })}

                  {piperDownloadProgress !== null && (
                    <div className="p-3 text-xs text-sky-300 bg-sky-950/60 rounded-xl border border-sky-800/40 text-center font-mono animate-pulse">
                      Descargando e inicializando modelo neural... {piperDownloadProgress}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
