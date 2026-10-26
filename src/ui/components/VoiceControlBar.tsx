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
    setIsVoiceMenuOpen(false);
  };

  const currentVoiceObj = rankedVoices.find((v) => v.name === ttsState.selectedVoiceName);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-nocturne-900/95 border border-sacred-gold/40 rounded-2xl shadow-2xl backdrop-blur-md text-zinc-200 p-3 sm:p-3.5 transition-all animate-in slide-in-from-bottom-3 duration-200">
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
                    Pasaje Bíblico Reverente (Tono Solemne)
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

        {/* Fila Inferior: Controles de Reproducción y Selectores */}
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Controles de Transporte (Anterior, Pausa/Play, Siguiente) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => offlineTts.previousChunk()}
              title="Segmento anterior"
              className="p-1.5 rounded-lg bg-nocturne-950 text-zinc-300 hover:text-white hover:bg-nocturne-800 transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {ttsState.isPaused ? (
              <button
                onClick={() => offlineTts.resume()}
                title="Reanudar locución"
                className="px-2.5 py-1.5 rounded-lg bg-sacred-gold text-nocturne-950 font-bold text-xs flex items-center gap-1 shadow-md hover:bg-sacred-gold/90 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reanudar</span>
              </button>
            ) : (
              <button
                onClick={() => offlineTts.pause()}
                title="Pausar locución"
                className="px-2.5 py-1.5 rounded-lg bg-nocturne-950 border border-sacred-gold/40 text-sacred-gold font-bold text-xs flex items-center gap-1 hover:bg-sacred-gold/20 transition-all"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar</span>
              </button>
            )}

            <button
              onClick={() => offlineTts.nextChunk()}
              title="Segmento siguiente"
              className="p-1.5 rounded-lg bg-nocturne-950 text-zinc-300 hover:text-white hover:bg-nocturne-800 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => offlineTts.stop()}
              title="Detener por completo"
              className="p-1.5 rounded-lg bg-nocturne-950 text-zinc-400 hover:text-rose-400 hover:bg-nocturne-800 transition-colors ml-1"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </div>

          {/* Selector de Velocidad */}
          <div className="flex items-center gap-1 bg-nocturne-950 p-1 rounded-xl border border-nocturne-800">
            <button
              onClick={() => offlineTts.setRate(0.85)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                Math.abs(ttsState.rate - 0.85) < 0.05
                  ? 'bg-sacred-gold text-nocturne-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              0.85x Calma
            </button>
            <button
              onClick={() => offlineTts.setRate(1.0)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                Math.abs(ttsState.rate - 1.0) < 0.05
                  ? 'bg-sacred-gold text-nocturne-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              1.0x Natural
            </button>
            <button
              onClick={() => offlineTts.setRate(1.2)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                Math.abs(ttsState.rate - 1.2) < 0.05
                  ? 'bg-sacred-gold text-nocturne-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              1.2x Rápido
            </button>
          </div>

          {/* Selector Rápido de Voz Humana */}
          <div className="relative">
            <button
              onClick={() => setIsVoiceMenuOpen(!isVoiceMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-nocturne-950 border border-nocturne-800 text-[11px] text-zinc-300 hover:border-sacred-gold/40 transition-colors"
            >
              {ttsState.activeEngineMode === 'PIPER_HD_OFFLINE' ? (
                <>
                  <Cpu className="w-3 h-3 text-sacred-gold" />
                  <span className="truncate max-w-[110px]">Piper Neural HD</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3 h-3 text-sacred-gold" />
                  <span className="truncate max-w-[110px]">
                    {currentVoiceObj?.name || 'Voz Neural'}
                  </span>
                </>
              )}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Menú Desplegable de Voces */}
            {isVoiceMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-72 max-h-64 overflow-y-auto rounded-xl bg-nocturne-900 border border-nocturne-750 shadow-2xl p-1.5 z-50 text-xs">
                {/* Voces Neurales del Sistema (0 MB) */}
                <div className="px-2 py-1 text-[10px] font-semibold text-sacred-gold uppercase tracking-wider">
                  Voces Neurales del Sistema (0 MB)
                </div>
                {rankedVoices.slice(0, 6).map((v) => (
                  <button
                    key={v.name}
                    onClick={() => handleSelectVoice(v.name)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                      ttsState.activeEngineMode === 'SYSTEM_NEURAL' &&
                      ttsState.selectedVoiceName === v.name
                        ? 'bg-sacred-gold/20 text-sacred-gold font-semibold'
                        : 'text-zinc-300 hover:bg-nocturne-800'
                    }`}
                  >
                    <span className="truncate">{v.displayName}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 bg-nocturne-950 text-zinc-400">
                      Score: {v.score}
                    </span>
                  </button>
                ))}

                {/* Modelos Piper Neural Offline (~35 MB) */}
                <div className="px-2 py-1 mt-2 text-[10px] font-semibold text-sky-400 uppercase tracking-wider border-t border-nocturne-800">
                  Estudio Neural Offline Piper (~35 MB)
                </div>
                {piperModels.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => handleSelectPiperModel(pm)}
                    disabled={piperDownloadProgress !== null}
                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                      ttsState.activeEngineMode === 'PIPER_HD_OFFLINE' &&
                      piperNeuralTts.getActiveModelId() === pm.id
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-zinc-300 hover:bg-nocturne-800'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <div className="truncate font-medium">{pm.name}</div>
                      <div className="text-[10px] text-zinc-400">{pm.region}</div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 bg-sky-950 text-sky-300 border border-sky-800/40">
                      {pm.isDownloaded ? 'Listo' : '35 MB'}
                    </span>
                  </button>
                ))}

                {piperDownloadProgress !== null && (
                  <div className="p-2 text-[10px] text-sky-300 bg-sky-950/50 rounded-lg mt-1 text-center font-mono">
                    Descargando modelo neural... {piperDownloadProgress}%
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
