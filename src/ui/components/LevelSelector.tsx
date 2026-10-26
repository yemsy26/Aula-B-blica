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
  hoverColor: string;
}[] = [
  {
    id: 'Semilla',
    label: 'Semilla',
    subtitle: 'Básico · Gracia y Vida',
    icon: Sprout,
    activeColor: 'bg-emerald-100/90 text-emerald-900 border-emerald-400 shadow-sm font-semibold',
    badgeColor: 'text-emerald-700',
    hoverColor: 'hover:text-emerald-800 hover:bg-emerald-50',
  },
  {
    id: 'Discipulo',
    label: 'Discípulo',
    subtitle: 'Intermedio · Verdad Celestial',
    icon: Scroll,
    activeColor: 'bg-sky-100/90 text-sky-950 border-sky-400 shadow-sm font-semibold',
    badgeColor: 'text-sky-700',
    hoverColor: 'hover:text-sky-800 hover:bg-sky-50',
  },
  {
    id: 'Maestro',
    label: 'Maestro',
    subtitle: 'Profundo · Gloria Shejiná',
    icon: BookMarked,
    activeColor: 'bg-amber-100/90 text-amber-950 border-amber-400 shadow-sm font-semibold',
    badgeColor: 'text-amber-800',
    hoverColor: 'hover:text-amber-900 hover:bg-amber-50',
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
                  : `text-zinc-400 ${lvl.hoverColor} border-transparent`
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
