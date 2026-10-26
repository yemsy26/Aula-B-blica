import React, { useState, useEffect } from 'react';
import { StudyNote } from '../../core/database/usuarioMemoriaService.js';
import {
  BookOpen,
  Share2,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  Printer,
  Bookmark,
  Volume2,
  Square,
  ArrowLeft,
  Menu,
} from 'lucide-react';
import { offlineTts } from '../../core/tts/offlineTtsService.js';
import { copyToClipboard } from '../../core/utils/clipboard.js';

interface StudyWhiteboardProps {
  studies: StudyNote[];
  onSaveStudy: (study: Omit<StudyNote, 'fecha_creacion' | 'fecha_actualizacion' | 'id'> & { id?: string }) => void;
  onDeleteStudy: (studyId: string) => void;
  onToggleMobileSidebar?: () => void;
}

export const StudyWhiteboard: React.FC<StudyWhiteboardProps> = ({
  studies,
  onSaveStudy,
  onDeleteStudy,
  onToggleMobileSidebar,
}) => {
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(
    studies.length > 0 ? studies[0].id : null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isMobileDetailView, setIsMobileDetailView] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    const unsub = offlineTts.subscribe((st) => {
      if (!st.isPlaying && !st.isPaused) {
        setIsPlayingAudio(false);
      }
    });
    return unsub;
  }, []);

  // Form State
  const [formTitulo, setFormTitulo] = useState('');
  const [formTema, setFormTema] = useState('');
  const [formVersiculo, setFormVersiculo] = useState('');
  const [formContenido, setFormContenido] = useState('');
  const [formPuntos, setFormPuntos] = useState('');

  const currentStudy = studies.find((s) => s.id === selectedStudyId) || studies[0];

  const handleCreateNew = () => {
    setFormTitulo('Nuevo Bosquejo Exegético');
    setFormTema('La Naturaleza de la Gracia');
    setFormVersiculo('Efesios 2:8-9');
    setFormPuntos('1. El don inmerecido\n2. La exclusión del mérito humano\n3. La gloria debida a Dios');
    setFormContenido(
      '### Introducción al Texto\n\nEl apóstol Pablo establece con precisión que la salvación no emana de la prudencia humana sino de la soberanía divina...\n\n> **«Porque por gracia sois salvos por la fe; y esto no de vosotros, pues es don de Dios: No por obras, para que nadie se gloríe.»** — *Efesios 2:8-9 (RV1909)*'
    );
    setIsEditing(true);
    setIsMobileDetailView(true);
  };

  const handleSave = () => {
    if (!formTitulo.trim()) return;

    onSaveStudy({
      id: isEditing && selectedStudyId ? selectedStudyId : undefined,
      titulo: formTitulo,
      tema: formTema,
      nivel_audiencia: 'Discipulo',
      versiculo_clave: formVersiculo,
      contenido_markdown: formContenido,
      bosquejo_puntos: formPuntos.split('\n').filter((p) => p.trim() !== ''),
      referencias_cruzadas: ['Romanos 3:24', 'Gálatas 2:16'],
      exportado_whatsapp: false,
      exportado_pdf: false,
    });

    setIsEditing(false);
  };

  const exportToWhatsApp = (study: StudyNote) => {
    // Formato nativo de mensajería: negritas *...*, citas en bloque >, viñetas limpias
    const bodyFormatted = study.contenido_markdown
      .replace(/###\s*(.+)/g, '*$1*')
      .replace(/^>\s*[*«"]+(.+?)[*»"]+\s*—\s*[*_]+(.+?)[*_]+/gm, '> «$1»\n> _— $2_')
      .replace(/^>\s*(.+)/gm, '> $1');

    const text = [
      `📖 *ESTUDIO BÍBLICO: ${study.titulo.toUpperCase()}*`,
      `🎯 *Tema:* ${study.tema}`,
      study.versiculo_clave ? `📌 *Versículo Clave:* ${study.versiculo_clave}` : '',
      `👤 *Nivel de Audiencia:* ${study.nivel_audiencia}`,
      '',
      `📋 *BOSQUEJO GENERAL:*`,
      ...study.bosquejo_puntos.map((p) => `• ${p}`),
      '',
      `📜 *DESARROLLO EXEGÉTICO:*`,
      bodyFormatted,
      '',
      study.referencias_cruzadas.length > 0
        ? `🔗 *Referencias Cruzadas (TSK):* ${study.referencias_cruzadas.join(', ')}`
        : '',
      '',
      `— _Generado por VerboVivo (100% Offline)_`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopiedStatus('whatsapp');
    setTimeout(() => setCopiedStatus(null), 2500);
  };

  const toggleSpeakStudy = (study: StudyNote) => {
    if (isPlayingAudio) {
      offlineTts.stop();
      setIsPlayingAudio(false);
    } else {
      const speech = `${study.titulo}. Tema: ${study.tema}. Bosquejo: ${study.bosquejo_puntos.join('. ')}. Desarrollo: ${study.contenido_markdown}`;
      offlineTts.speak(speech, () => {
        setIsPlayingAudio(false);
      });
      setIsPlayingAudio(true);
    }
  };

  const copyMarkdown = async (study: StudyNote) => {
    const success = await copyToClipboard(study.contenido_markdown);
    if (success) {
      setCopiedStatus('markdown');
      setTimeout(() => setCopiedStatus(null), 2500);
    }
  };

  return (
    <div className="flex-1 h-full flex bg-nocturne-950 overflow-hidden text-zinc-200">
      {/* Columna Izquierda: Lista de Estudios Fijados */}
      <div
        className={`w-full md:w-72 border-r border-nocturne-800 bg-nocturne-900 flex flex-col shrink-0 ${
          isMobileDetailView ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-3.5 sm:p-4 pt-[max(env(safe-area-inset-top,0px),1.85rem)] sm:pt-4 border-b border-nocturne-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            <BookOpen className="w-4 h-4 text-sacred-gold shrink-0" />
            <h2 className="text-xs sm:text-sm font-semibold tracking-wide text-parchment-100">
              Pizarra de Estudio
            </h2>
          </div>
          <button
            onClick={handleCreateNew}
            className="p-1.5 rounded-lg bg-sacred-gold/15 text-sacred-gold hover:bg-sacred-gold/25 transition-colors"
            title="Crear nuevo estudio"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {studies.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              Aún no has fijado ningún estudio en la pizarra.
            </div>
          ) : (
            studies.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setSelectedStudyId(s.id);
                  setIsEditing(false);
                  setIsMobileDetailView(true);
                }}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedStudyId === s.id && !isEditing
                    ? 'bg-nocturne-800 border-sacred-gold/40 text-parchment-100'
                    : 'bg-nocturne-850/50 hover:bg-nocturne-850 border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold truncate leading-tight">{s.titulo}</h4>
                  <Bookmark className="w-3.5 h-3.5 text-sacred-gold shrink-0 ml-1" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 truncate">Tema: {s.tema}</p>
                {s.versiculo_clave && (
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-nocturne-950 text-sacred-gold font-mono">
                    {s.versiculo_clave}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Columna Derecha: Vista del Estudio o Editor */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden bg-nocturne-950 ${
          !isMobileDetailView ? 'hidden md:flex' : 'flex'
        }`}
      >
        {isEditing ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setIsMobileDetailView(false);
                }}
                className="md:hidden p-1.5 rounded-lg text-zinc-300 hover:text-zinc-900 bg-nocturne-800 border border-nocturne-700 flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
              <h3 className="text-sm sm:text-base font-serif font-bold text-parchment-100">
                Redactar Bosquejo / Estudio Bíblico
              </h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Título</label>
              <input
                type="text"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="w-full px-3 py-2 bg-nocturne-900 border border-nocturne-700 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-sacred-gold"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Tema Doctrinal</label>
                <input
                  type="text"
                  value={formTema}
                  onChange={(e) => setFormTema(e.target.value)}
                  className="w-full px-3 py-2 bg-nocturne-900 border border-nocturne-700 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-sacred-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Versículo Clave</label>
                <input
                  type="text"
                  value={formVersiculo}
                  onChange={(e) => setFormVersiculo(e.target.value)}
                  placeholder="ej: Juan 3:16"
                  className="w-full px-3 py-2 bg-nocturne-900 border border-nocturne-700 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-sacred-gold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Puntos del Bosquejo (uno por línea)
              </label>
              <textarea
                rows={3}
                value={formPuntos}
                onChange={(e) => setFormPuntos(e.target.value)}
                className="w-full px-3 py-2 bg-nocturne-900 border border-nocturne-700 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-sacred-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Contenido Markdown y Citas Inmutables
              </label>
              <textarea
                rows={8}
                value={formContenido}
                onChange={(e) => setFormContenido(e.target.value)}
                className="w-full p-3 bg-nocturne-900 border border-nocturne-700 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-sacred-gold"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-sacred-gold text-nocturne-950 font-semibold rounded-xl text-xs hover:bg-sacred-gold-light transition-colors"
              >
                Guardar en Cuaderno
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setIsMobileDetailView(false);
                }}
                className="px-4 py-2 bg-nocturne-800 text-zinc-300 rounded-xl text-xs hover:bg-nocturne-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : currentStudy ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Barra de Herramientas de Exportación */}
            <div className="p-3 sm:p-4 border-b border-nocturne-800 flex flex-wrap items-center justify-between bg-nocturne-900/60 backdrop-blur-md gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileDetailView(false)}
                  className="md:hidden p-1.5 rounded-lg text-zinc-300 hover:text-zinc-900 bg-nocturne-800 border border-nocturne-700 flex items-center gap-1 text-xs shrink-0"
                  title="Volver a lista"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-serif font-bold text-parchment-100 truncate">
                    {currentStudy.titulo}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 truncate">
                    <span>Tema: <strong className="text-zinc-200">{currentStudy.tema}</strong></span>
                    {currentStudy.versiculo_clave && (
                      <span className="text-sacred-gold font-mono hidden sm:inline">• {currentStudy.versiculo_clave}</span>
                    )}
                    <span className="hidden sm:inline">• Nivel: {currentStudy.nivel_audiencia}</span>
                  </div>
                </div>
              </div>

              {/* Botones de Exportar */}
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <button
                  onClick={() => toggleSpeakStudy(currentStudy)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    isPlayingAudio
                      ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                      : 'bg-nocturne-800 text-zinc-300 border-nocturne-700 hover:text-sacred-gold hover:border-sacred-gold/40'
                  }`}
                  title="Escuchar estudio con voz offline"
                >
                  {isPlayingAudio ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Detener</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-sacred-gold" />
                      <span>Voz</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => exportToWhatsApp(currentStudy)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold hover:bg-emerald-200 transition-colors"
                  title="Copiar con formato nativo optimizado para WhatsApp (*negritas*, > citas)"
                >
                  {copiedStatus === 'whatsapp' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => copyMarkdown(currentStudy)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-nocturne-800 text-zinc-300 border border-nocturne-700 text-xs font-medium hover:bg-nocturne-700 transition-colors"
                  title="Copiar Markdown puro"
                >
                  {copiedStatus === 'markdown' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Markdown</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="p-1.5 sm:p-2 rounded-lg bg-nocturne-800 text-zinc-300 hover:text-zinc-900 transition-colors"
                  title="Imprimir / Exportar a PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    onDeleteStudy(currentStudy.id);
                    setIsMobileDetailView(false);
                  }}
                  className="p-1.5 sm:p-2 rounded-lg bg-nocturne-800 text-zinc-400 hover:text-rose-400 transition-colors"
                  title="Eliminar estudio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Contenido Editorial del Estudio */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-4 sm:space-y-6">
              {/* Bloque del Bosquejo de Puntos */}
              {currentStudy.bosquejo_puntos.length > 0 && (
                <div className="p-4 rounded-2xl bg-nocturne-900 border border-nocturne-800 shadow-sm">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-sacred-gold mb-2.5">
                    Estructura Homilética del Bosquejo
                  </h4>
                  <ul className="space-y-1.5">
                    {currentStudy.bosquejo_puntos.map((punto, idx) => (
                      <li key={idx} className="text-sm text-zinc-200 flex items-start gap-2">
                        <span className="text-sacred-gold font-bold">•</span>
                        <span>{punto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cuerpo del Estudio */}
              <div className="prose prose-invert max-w-none text-zinc-300 font-bible text-base leading-relaxed space-y-4">
                {currentStudy.contenido_markdown.split('\n\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('>')) {
                    return (
                      <blockquote
                        key={idx}
                        className="verse-quote-card my-4 p-4 rounded-r-xl border-l-4 border-sacred-gold bg-sacred-gold/5 font-bible text-parchment-100 italic"
                      >
                        {paragraph.replace(/^>\s*/gm, '')}
                      </blockquote>
                    );
                  }
                  if (paragraph.startsWith('###')) {
                    return (
                      <h3
                        key={idx}
                        className="text-lg font-serif font-bold text-parchment-100 mt-6 mb-2 border-b border-nocturne-800 pb-1"
                      >
                        {paragraph.replace('###', '').trim()}
                      </h3>
                    );
                  }
                  return <p key={idx}>{paragraph}</p>;
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
            <BookOpen className="w-12 h-12 text-zinc-400" />
            <p className="text-sm">Selecciona o crea un estudio para visualizarlo</p>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-xl bg-sacred-gold text-nocturne-950 font-semibold text-xs hover:bg-sacred-gold-light transition-colors"
            >
              Crear Nuevo Bosquejo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
