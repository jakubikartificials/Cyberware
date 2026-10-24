import React from 'react';
import { PlayerStats } from '../types';
import { Trophy, RotateCcw, Home, Sparkles } from 'lucide-react';

interface VictoryModalProps {
  stats: PlayerStats;
  onPlayAgain: () => void;
  onQuitTitle: () => void;
  isNewBest: boolean;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  stats,
  onPlayAgain,
  onQuitTitle,
  isNewBest,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/90 select-none pointer-events-auto">
      <div className="w-full max-w-lg p-8 bg-black border border-emerald-400/50 flex flex-col gap-6 shadow-[0_0_60px_rgba(0,255,150,0.2)]">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 border border-emerald-400 flex items-center justify-center bg-emerald-950/40 shadow-[0_0_20px_rgba(0,255,150,0.4)]">
            <Trophy className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="font-mono text-xs tracking-widest text-emerald-400 uppercase font-bold">
            SECTOR 04 EXTRACTION SUCCESSFUL
          </div>
          <h2 className="text-3xl sm:text-4xl font-mono font-black tracking-tight text-white wire-glow-emerald">
            PRISMATIC CORE EXTRACTED
          </h2>
          <p className="font-mono text-xs text-white/70 max-w-sm">
            All labyrinth sectors breached. You synchronized with the wire pulse and successfully escaped the maze.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 font-mono text-xs">
          <div className="p-3 bg-white/5 border border-white/10 flex flex-col gap-1">
            <span className="text-[10px] text-white/50 tracking-wider">TOTAL RUN TIME</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white tabular-nums">
                {formatTime(stats.elapsedTime)}
              </span>
              {isNewBest && (
                <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500 text-black font-bold">
                  NEW BEST!
                </span>
              )}
            </div>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 flex flex-col gap-1">
            <span className="text-[10px] text-white/50 tracking-wider">CHRONO CUBES</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xl font-bold text-white tabular-nums">
                {stats.cubesCollected} / {stats.totalCubes}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 flex flex-col gap-1">
            <span className="text-[10px] text-white/50 tracking-wider">MAX BEAT COMBO</span>
            <span className="text-xl font-bold text-pink-400 tabular-nums">
              x{stats.maxBeatCombo}
            </span>
          </div>

          <div className="p-3 bg-white/5 border border-white/10 flex flex-col gap-1">
            <span className="text-[10px] text-white/50 tracking-wider">FINAL SCORE</span>
            <span className="text-xl font-bold text-amber-400 tabular-nums">
              {stats.score.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 font-mono text-xs font-semibold pt-2">
          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-emerald-400 text-black hover:bg-emerald-300 transition-colors cursor-pointer font-bold tracking-wider"
          >
            <RotateCcw className="w-4 h-4" /> PLAY AGAIN [ENTER]
          </button>

          <button
            onClick={onQuitTitle}
            className="w-full sm:w-auto flex items-center justify-center gap-2 p-3.5 bg-black border border-white/30 text-white hover:border-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" /> TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
};
