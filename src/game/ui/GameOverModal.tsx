import React from 'react';
import { PlayerStats } from '../types';
import { RotateCcw, Home, AlertTriangle } from 'lucide-react';

interface GameOverModalProps {
  stats: PlayerStats;
  onRespawn: () => void;
  onRestartSector: () => void;
  onQuitTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  onRespawn,
  onRestartSector,
  onQuitTitle,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/90 select-none pointer-events-auto">
      <div className="w-full max-w-md p-8 bg-black border border-rose-500/50 flex flex-col gap-6 shadow-[0_0_60px_rgba(255,0,85,0.25)]">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 border border-rose-500 flex items-center justify-center bg-rose-950/40">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <div className="font-mono text-xs tracking-widest text-rose-500 uppercase font-bold">
            INTEGRITY BREACHED // DE-REZZED
          </div>
          <h2 className="text-3xl font-mono font-black tracking-tight text-white uppercase">
            SIMULATION FAILED
          </h2>
          <p className="font-mono text-xs text-white/60">
            Vector integrity dropped to 0%. Checkpoint restore memory is ready for instantaneous re-link.
          </p>
        </div>

        {/* Checkpoint Status */}
        <div className="p-3 bg-white/5 border border-white/10 flex items-center justify-between font-mono text-xs">
          <span className="text-white/50">LAST CHECKPOINT:</span>
          <span className="text-cyan-400 font-bold">{stats.checkpointName}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 font-mono text-xs font-semibold">
          <button
            onClick={onRespawn}
            className="flex items-center justify-center gap-2 p-3.5 bg-rose-500 text-white hover:bg-rose-400 transition-colors cursor-pointer font-bold tracking-wider"
          >
            <RotateCcw className="w-4 h-4" /> RESTORE AT CHECKPOINT [SPACE / ENTER]
          </button>

          <button
            onClick={onRestartSector}
            className="flex items-center justify-center gap-2 p-3 bg-black border border-white/20 text-white hover:border-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> RESTART CURRENT SECTOR
          </button>

          <button
            onClick={onQuitTitle}
            className="flex items-center justify-center gap-2 p-3 bg-black border border-white/20 text-white/70 hover:text-white hover:border-white transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" /> RETURN TO TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
};
