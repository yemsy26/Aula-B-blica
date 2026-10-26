import React from 'react';
import { CrisisDetectionResult } from '../../core/shield/types.js';
import { HeartHandshake, ShieldAlert, PhoneCall, X } from 'lucide-react';

interface CrisisBannerProps {
  crisis: CrisisDetectionResult;
  onDismiss?: () => void;
}

export const CrisisBanner: React.FC<CrisisBannerProps> = ({ crisis, onDismiss }) => {
  if (!crisis.isCrisis || !crisis.immediatePastoralAction) return null;

  const action = crisis.immediatePastoralAction;

  return (
    <div className="mx-4 my-3 p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-amber-950/30 to-red-950/40 border border-red-500/40 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 text-amber-300 font-semibold text-sm">
          <HeartHandshake className="w-5 h-5 text-red-400 shrink-0" />
          <span>Protocolo de Contención Pastoral Inmediata</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-md"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-zinc-200 leading-relaxed font-sans">
        {action.pastoralMessage}
      </p>

      {action.biblicalAnchors.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-black/30 border border-amber-500/20">
          <p className="text-xs uppercase tracking-wider text-amber-400/90 font-medium mb-1.5 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Anclas de Promesa y Refugio
          </p>
          <ul className="space-y-1">
            {action.biblicalAnchors.map((anchor, idx) => (
              <li key={idx} className="text-xs text-parchment-200 font-bible italic">
                • {anchor}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-rose-300 bg-red-950/50 p-2.5 rounded-lg border border-red-800/40">
        <PhoneCall className="w-4 h-4 shrink-0 text-red-400" />
        <span>{action.helplineRecommendation}</span>
      </div>
    </div>
  );
};
