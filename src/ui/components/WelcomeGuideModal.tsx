import React, { useState } from 'react';
import {
  X,
  Compass,
  MessageSquare,
  BookOpen,
  Sparkles,
  Sun,
  Sprout,
  Scroll,
  BookMarked,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface WelcomeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string) => void;
}

export const WelcomeGuideModal: React.FC<WelcomeGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'levels' | 'quickstart'>('map');

  if (!isOpen) return null;

  const handlePromptClick = (text: string) => {
    onSelectPrompt(text);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-nocturne-900 border border-nocturne-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-200">
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-nocturne-800 flex items-center justify-between bg-nocturne-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sacred-gold/20 border border-sacred-gold/40 flex items-center justify-center text-sacred-gold font-serif font-bold text-lg shadow-sm">
              ✝
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-parchment-100 flex items-center gap-2">
                <span>Guía de Bienvenida · VerboVivo</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 font-mono hidden sm:inline-block">
                  100% Offline
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Todo lo que necesitas saber para navegar tu Agente Teológico Edge AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-nocturne-800 transition-colors"
            title="Cerrar guía"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de la Guía */}
        <div className="grid grid-cols-3 border-b border-nocturne-800 bg-nocturne-950/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`py-2.5 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'map'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Mapa del Sistema</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('levels')}
            className={`py-2.5 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'levels'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Los 3 Niveles</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quickstart')}
            className={`py-2.5 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'quickstart'
                ? 'border-sacred-gold text-sacred-gold bg-nocturne-850/50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Probar Ahora (1 Clic)</span>
          </button>
        </div>

        {/* Contenido Desplazable */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {activeTab === 'map' && (
            <div className="space-y-3">
              <p className="text-zinc-300 text-xs leading-relaxed">
                VerboVivo está organizado en 3 áreas principales y una barra de herramientas teológicas superior:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800">
                  <div className="flex items-center gap-2 text-sacred-gold font-semibold text-xs mb-1">
                    <MessageSquare className="w-4 h-4" />
                    <span>1. Chat Bíblico (Ventana Principal)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Escribe tus consultas en español cotidiano o jerga. El <strong>Escudo Limpiador</strong> normaliza modismos en &lt; 5 ms y recupera versículos exactos de SQLite sin alucinaciones.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800">
                  <div className="flex items-center gap-2 text-sacred-gold font-semibold text-xs mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span>2. Pizarra de Estudio (Pestaña)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Tu cuaderno homilético. Cualquier respuesta del chat puede fijarse aquí con el botón <strong>"Fijar"</strong> para editarla y exportarla a <strong>WhatsApp</strong> o <strong>PDF</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800">
                  <div className="flex items-center gap-2 text-sacred-gold font-semibold text-xs mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>3. Concordancia Strong (Pestaña)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Diccionario lexicográfico canónico para explorar raíces en Hebreo (H) y Griego (G), como <em>bará</em> (H1254) o <em>agape</em> (G26).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-nocturne-950 border border-nocturne-800">
                  <div className="flex items-center gap-2 text-sacred-gold font-semibold text-xs mb-1">
                    <Sun className="w-4 h-4" />
                    <span>4. Pan Diario (Botón ☀️)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Devocional matutino personalizado según tu historial espiritual. Puedes escucharlo con el reproductor de voz offline.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sacred-gold/10 border border-sacred-gold/25 flex items-start gap-2 text-[11px] text-sacred-gold-light">
                <ShieldCheck className="w-4 h-4 text-sacred-gold shrink-0 mt-0.5" />
                <span>
                  <strong>Sin Internet:</strong> Todos los datos, historiales, índices FTS y notas residen en el almacenamiento privado de tu dispositivo. Ninguna consulta viaja a la nube.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'levels' && (
            <div className="space-y-3">
              <p className="text-zinc-300 text-xs leading-relaxed">
                Puedes cambiar el nivel teológico en cualquier momento desde el selector superior derecho:
              </p>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs mb-1">
                    <Sprout className="w-4 h-4 text-emerald-400" />
                    <span>Nivel Semilla (Básico · Cotidiano · Devocional)</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Ideal para comenzar el día, consejería emocional y respuestas claras y consoladoras. Respuestas directas, cálidas y sin tecnicismos complejos.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs mb-1">
                    <Scroll className="w-4 h-4 text-amber-400" />
                    <span>Nivel Discípulo (Intermedio · Histórico · Sistemático)</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Para maestros de escuela dominical y estudiantes. Conecta temas bíblicos con su contexto histórico, el pacto de Dios y referencias cruzadas (TSK).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs mb-1">
                    <BookMarked className="w-4 h-4 text-indigo-400" />
                    <span>Nivel Maestro (Profundo · Exegético · Raíces)</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Para pastores y teólogos. Incluye análisis en Hebreo y Griego Koiné, códigos Strong, quiasmos literarios y crítica textual rigurosa.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quickstart' && (
            <div className="space-y-3">
              <p className="text-zinc-300 text-xs">
                Haz clic en cualquiera de estas consultas para iniciar una demostración inmediata:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handlePromptClick('quiero estudiar el libro de mateo que me recomiendas')}
                  className="w-full p-3 rounded-xl bg-nocturne-950 hover:bg-nocturne-850 border border-nocturne-800 hover:border-sacred-gold/50 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <span className="block text-[10px] uppercase font-mono text-sacred-gold">Estudio Bíblico</span>
                    <span className="text-xs text-zinc-200 group-hover:text-sacred-gold-light font-medium">
                      "Quiero estudiar el libro de Mateo, ¿qué me recomiendas?"
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-sacred-gold shrink-0 ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptClick('tengo mucha ansiedad y miedo por mi futuro que dice la biblia')}
                  className="w-full p-3 rounded-xl bg-nocturne-950 hover:bg-nocturne-850 border border-nocturne-800 hover:border-sacred-gold/50 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <span className="block text-[10px] uppercase font-mono text-emerald-400">Consejería Pastoral</span>
                    <span className="text-xs text-zinc-200 group-hover:text-emerald-300 font-medium">
                      "Tengo mucha ansiedad y miedo por mi futuro, ¿qué dice la Biblia?"
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 shrink-0 ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptClick('analiza el significado exegetico de bara H1254 en genesis 1:1')}
                  className="w-full p-3 rounded-xl bg-nocturne-950 hover:bg-nocturne-850 border border-nocturne-800 hover:border-sacred-gold/50 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <span className="block text-[10px] uppercase font-mono text-indigo-400">Exégesis en Hebreo</span>
                    <span className="text-xs text-zinc-200 group-hover:text-indigo-300 font-medium">
                      "Analiza el significado exegético de bará H1254 en Génesis 1:1"
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400 shrink-0 ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptClick('explicame el pacto abrahamico y su relacion con cristo')}
                  className="w-full p-3 rounded-xl bg-nocturne-950 hover:bg-nocturne-850 border border-nocturne-800 hover:border-sacred-gold/50 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <span className="block text-[10px] uppercase font-mono text-amber-400">Teología Bíblica</span>
                    <span className="text-xs text-zinc-200 group-hover:text-amber-300 font-medium">
                      "Explícame el pacto abrahámico y su relación con Cristo"
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 shrink-0 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-3.5 sm:p-4 border-t border-nocturne-800 bg-nocturne-950 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 font-mono">
            Puedes abrir esta guía en cualquier momento con el botón <strong>❓ Guía</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-sacred-gold text-nocturne-950 font-bold rounded-xl text-xs hover:bg-sacred-gold-light transition-all shadow-md"
          >
            ¡Entendido, Comenzar!
          </button>
        </div>
      </div>
    </div>
  );
};
