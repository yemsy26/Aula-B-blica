import React, { useState, useEffect } from 'react';
import { DailyBreadCardData } from '../../core/retention/types.js';
import { offlineTts } from '../../core/tts/offlineTtsService.js';
import {
  Sun,
  Volume2,
  Square,
  BookOpen,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface DailyBreadCardProps {
  data: DailyBreadCardData;
  onStartStudyFromVerse: (ref: string, verseText: string) => void;
  onDismiss?: () => void;
}

export const DailyBreadCard: React.FC<DailyBreadCardProps> = ({
  data,
  onStartStudyFromVerse,
  onDismiss,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    const unsub = offlineTts.subscribe((st) => {
      if (!st.isPlaying && !st.isPaused) {
        setIsPlayingAudio(false);
      }
    });
    return unsub;
  }, []);

  const handleToggleVoice = () => {
    if (isPlayingAudio) {
      offlineTts.stop();
      setIsPlayingAudio(false);
    } else {
      const speechText = `Pan Diario para hoy. ${data.temaRelacionado}. ${data.versiculoReferencia}. ${data.versiculoTexto}. Reflexión: ${data.reflexionPastoral}. Pregunta para tu día: ${data.preguntaDelDia}`;
      offlineTts.speak(speechText, () => {
        setIsPlayingAudio(false);
      });
      setIsPlayingAudio(true);
    }
  };

  return (
    <div className="mx-0 my-2 sm:my-3 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-nocturne-900 via-nocturne-850 to-nocturne-900 border border-sacred-gold/30 shadow-lg backdrop-blur-md relative smooth-gpu">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sacred-gold/20 border border-sacred-gold/40 flex items-center justify-center text-sacred-gold shrink-0">
            <Sun className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest text-sacred-gold font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Pan Diario Personalizado
            </span>
            <h3 className="text-xs sm:text-sm font-serif font-bold text-parchment-100 leading-tight truncate">
              {data.temaRelacionado}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={handleToggleVoice}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border text-xs flex items-center gap-1 sm:gap-1.5 transition-all ${
              isPlayingAudio
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                : 'bg-nocturne-800 border-nocturne-700 text-zinc-300 hover:text-white hover:border-sacred-gold/40'
            }`}
            title={isPlayingAudio ? 'Detener voz' : 'Escuchar con voz offline'}
          >
            {isPlayingAudio ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="text-[10px] sm:text-[11px] font-mono">Detener</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-sacred-gold" />
                <span className="text-[10px] sm:text-[11px] font-mono">Escuchar</span>
              </>
            )}
          </button>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-nocturne-800 transition-colors"
              title="Cerrar devocional"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cita Bíblica Inmutable */}
      <div className="mt-2.5 sm:mt-3 p-3 sm:p-3.5 rounded-xl bg-black/40 border-l-4 border-sacred-gold text-parchment-100 font-bible text-xs sm:text-sm italic leading-relaxed">
        <p>«{data.versiculoTexto}»</p>
        <div className="mt-1 text-right text-[11px] sm:text-xs font-sans not-italic text-sacred-gold font-medium">
          — {data.versiculoReferencia} ({data.version})
        </div>
      </div>

      {/* Reflexión y Pregunta */}
      <div className="mt-2.5 sm:mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 text-[11px] sm:text-xs">
        <div className="p-2.5 sm:p-3 rounded-xl bg-nocturne-950/70 border border-nocturne-800 text-zinc-300 leading-relaxed font-sans">
          <span className="block text-[9px] sm:text-[10px] uppercase font-mono tracking-wider text-zinc-400 mb-1">
            Reflexión Pastoral
          </span>
          {data.reflexionPastoral}
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-nocturne-950/70 border border-nocturne-800 text-zinc-300 leading-relaxed font-sans flex flex-col justify-between">
          <div>
            <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-wider text-sacred-gold mb-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> Pregunta del Día
            </span>
            <p className="italic text-zinc-200">{data.preguntaDelDia}</p>
          </div>

          <div className="pt-2 text-right">
            <button
              onClick={() => onStartStudyFromVerse(data.versiculoReferencia, data.versiculoTexto)}
              className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-sacred-gold hover:text-sacred-gold-light transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Profundizar en un Estudio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
