import React from 'react';
import { UserTheologicalLevel } from '../../core/shield/types.js';
import { Sprout, Scroll, BookMarked } from 'lucide-react';

interface LevelSelectorProps {
  currentLevel: UserTheologicalLevel;
  onChange: (level: UserTheologicalLevel) => void;
  disabled?: boolean;
}

const LEVELS: {
  id: UserTheologicalLevel;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  activeColor: string;
  badgeColor: string;
}[] = [
  {
    id: 'Semilla',
    label: 'Semilla',
    subtitle: 'Básico · Cotidiano',
    icon: Sprout,
    activeColor: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow-emerald-950/20',
    badgeColor: 'text-emerald-400',
  },
  {
    id: 'Discipulo',
    label: 'Discípulo',
    subtitle: 'Intermedio · Histórico',
    icon: Scroll,
    activeColor: 'bg-amber-600/20 text-amber-300 border-amber-500/50 shadow-amber-950/20',
    badgeColor: 'text-amber-400',
  },
  {
    id: 'Maestro',
    label: 'Maestro',
    subtitle: 'Profundo · Exegético',
    icon: BookMarked,
    activeColor: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-indigo-950/20',
    badgeColor: 'text-indigo-400',
  },
];

export const LevelSelector: React.FC<LevelSelectorProps> = ({
  currentLevel,
  onChange,
  disabled = false,
}) => {
  const currentLevelObj = LEVELS.find((l) => l.id === currentLevel) || LEVELS[0];
  const CurrentIcon = currentLevelObj.icon;

  const cycleNextLevel = () => {
    if (disabled) return;
    const currentIndex = LEVELS.findIndex((l) => l.id === currentLevel);
    const nextIndex = (currentIndex + 1) % LEVELS.length;
    onChange(LEVELS[nextIndex].id);
  };

  return (
    <>
      {/* Versión Móvil Compacta: 1 solo botón interactivo que alterna niveles con 1 toque */}
      <button
        type="button"
        disabled={disabled}
        onClick={cycleNextLevel}
        title={`Nivel actual: ${currentLevelObj.label}. Toca para cambiar de nivel.`}
        className={`sm:hidden flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium border transition-all ${currentLevelObj.activeColor} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'
        }`}
      >
        <CurrentIcon className={`w-3.5 h-3.5 ${currentLevelObj.badgeColor}`} />
        <span className="font-semibold">{currentLevelObj.label}</span>
      </button>

      {/* Versión Escritorio / Pantalla Media (sm+): Selector Completo de 3 Niveles */}
      <div className="hidden sm:flex items-center gap-1.5 p-1 bg-nocturne-900/80 rounded-xl border border-nocturne-800 backdrop-blur-md">
        {LEVELS.map((lvl) => {
          const Icon = lvl.icon;
          const isSelected = currentLevel === lvl.id;

          return (
            <button
              key={lvl.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(lvl.id)}
              title={`${lvl.label} - ${lvl.subtitle}`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 smooth-gpu border ${
                isSelected
                  ? `${lvl.activeColor} border shadow-sm`
                  : 'text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-nocturne-800/60'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? lvl.badgeColor : 'text-zinc-400'}`} />
              <span>{lvl.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
