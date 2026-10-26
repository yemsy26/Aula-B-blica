import React, { useState } from 'react';
import { StrongSeed } from '../../core/database/seedData.js';
import { BibliaCoreService } from '../../core/database/bibliaCoreService.js';
import { Search, Sparkles, BookOpen, Layers, Menu } from 'lucide-react';

interface StrongModalProps {
  bibliaService: BibliaCoreService;
  onClose?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const StrongModal: React.FC<StrongModalProps> = ({ bibliaService, onToggleMobileSidebar }) => {
  const [searchCode, setSearchCode] = useState('G26');
  const [entry, setEntry] = useState<StrongSeed | null>(() => bibliaService.getStrongEntry('G26'));

  const handleSearch = (codeToSearch: string) => {
    const res = bibliaService.getStrongEntry(codeToSearch);
    setEntry(res);
  };

  const sampleCodes = ['H1254', 'H7225', 'H430', 'H3068', 'G26', 'G3056', 'G5485', 'G4102', 'G4151'];

  return (
    <div className="flex-1 h-full flex flex-col bg-nocturne-950 p-4 sm:p-6 overflow-y-auto max-w-4xl mx-auto w-full text-zinc-200">
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-nocturne-800">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="md:hidden p-1.5 rounded-lg bg-nocturne-800 hover:bg-nocturne-750 text-zinc-300 hover:text-white border border-nocturne-700 transition-colors"
              title="Abrir menú"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-serif font-bold text-parchment-100">
              Concordancia Strong
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">
              Raíces canónicas en Hebreo, Arameo y Griego Koiné
            </p>
          </div>
        </div>
      </div>

      {/* Buscador de Código */}
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchCode}
            onChange={(e) => {
              setSearchCode(e.target.value);
              handleSearch(e.target.value);
            }}
            placeholder="Introduce código Strong (ej: H1254, G26, G3056)..."
            className="w-full pl-9 pr-4 py-2.5 bg-nocturne-900 border border-nocturne-700 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-sacred-gold uppercase font-mono"
          />
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-zinc-400 mr-1">Términos Clave:</span>
        {sampleCodes.map((c) => (
          <button
            key={c}
            onClick={() => {
              setSearchCode(c);
              handleSearch(c);
            }}
            className={`px-2 py-1 rounded-md text-xs font-mono transition-colors border ${
              searchCode.toUpperCase() === c
                ? 'bg-sacred-gold/20 text-sacred-gold-light border-sacred-gold/40'
                : 'bg-nocturne-900 text-zinc-400 hover:text-zinc-200 border-nocturne-800'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Ficha Lexicográfica */}
      {entry ? (
        <div className="mt-6 p-6 rounded-2xl bg-nocturne-900/90 border border-nocturne-800 shadow-xl space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                {entry.codigo} · {entry.idioma}
              </span>
              <h3 className="text-3xl font-serif text-sacred-gold-light mt-2 tracking-wide">
                {entry.palabra_original}
              </h3>
              <p className="text-sm text-zinc-400 font-mono mt-0.5">
                Transliteración: <strong className="text-zinc-200">{entry.transliteracion}</strong> ·
                Pronunciación: <em className="text-zinc-400">/{entry.pronunciacion}/</em>
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-400 block">Ocurrencias en el Canon</span>
              <strong className="text-lg font-mono text-emerald-400">
                {entry.frecuencia_ocurrencia} veces
              </strong>
            </div>
          </div>

          <div className="pt-3 border-t border-nocturne-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-sacred-gold" />
              Definición Exegética Canónica
            </h4>
            <p className="text-sm text-zinc-200 leading-relaxed font-sans">{entry.definicion}</p>
          </div>

          {entry.etimologia && (
            <div className="p-3 rounded-xl bg-black/30 border border-nocturne-800 text-xs text-zinc-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sacred-gold shrink-0" />
              <span>
                <strong>Etimología y Raíz:</strong> {entry.etimologia}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 p-8 text-center text-zinc-400 bg-nocturne-900/50 rounded-2xl border border-nocturne-800">
          No se encontró el código Strong en el diccionario local. Prueba con H1254 (Bara) o G26 (Agape).
        </div>
      )}
    </div>
  );
};
