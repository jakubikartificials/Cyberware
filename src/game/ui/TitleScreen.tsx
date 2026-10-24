import React from 'react';
import { GameDifficulty } from '../types';
import { Play, Volume2, VolumeX } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  difficulty: GameDifficulty;
  onSetDifficulty: (diff: GameDifficulty) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  bestTime: number | null;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  difficulty,
  onSetDifficulty,
  isMuted,
  onToggleMute,
  bestTime,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-8 sm:p-12 pointer-events-auto select-none bg-gradient-to-b from-black/60 via-transparent to-black/80">
      {/* Top Header: Audio & Status */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 border border-white/20 bg-black/60 px-3 py-1 font-mono text-xs tracking-widest text-white/70">
          <span className="w-2 h-2 bg-cyan-400" />
          <span>CYBERNETIC VECTOR SIMULATION // 120 BPM</span>
        </div>

        <div className="flex items-center gap-3">
          {bestTime !== null && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 border border-white/20 bg-black/60 font-mono text-xs">
              <span className="text-white/40">BEST RECORD:</span>
              <span className="text-emerald-400 font-bold tabular-nums">{formatTime(bestTime)}</span>
            </div>
          )}
          <button
            onClick={onToggleMute}
            className="flex items-center gap-2 px-3 py-1 border border-white/30 bg-black/70 font-mono text-xs text-white/80 hover:text-white hover:border-white transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>AUDIO: {isMuted ? 'OFF' : 'ON'} [M]</span>
          </button>
        </div>
      </div>

      {/* Main Centerpiece: Bespoke Inline SVG Title Lockup with 30-40% Negative Space */}
      <div className="my-auto max-w-2xl flex flex-col gap-6">
        <div className="space-y-2">
          {/* Bespoke inline SVG wireframe logo lockup */}
          <div className="flex items-center gap-4">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              {/* Outer Wireframe Hexagon */}
              <polygon points="32,4 58,18 58,46 32,60 6,46 6,18" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />
              {/* Inner Wire Isometric Cube */}
              <path d="M32 16 L50 26 L50 48 L32 58 L14 48 L14 26 Z" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
              <path d="M32 16 L32 38 M14 26 L32 38 M50 26 L32 38" stroke="#00f0ff" strokeWidth="1.5" />
              {/* Neon Pulse Node */}
              <circle cx="32" cy="38" r="3" fill="#ff007f" />
            </svg>
            <div>
              <div className="font-mono text-xs tracking-widest text-cyan-400 font-bold uppercase">
                FIRST-PERSON LABYRINTH RUNNER
              </div>
              <h1 className="text-4xl sm:text-6xl font-mono font-black tracking-tight text-white wire-glow-white uppercase">
                CYBERWIRE
              </h1>
            </div>
          </div>

          <p className="font-mono text-sm sm:text-base text-white/70 max-w-lg leading-relaxed">
            Navigate a towering, low-poly wireframe labyrinth in first-person. Synchronize jumps and dashes with the 120 BPM procedural pulse to bypass shifting maze gates, laser grids, and alternating phase platforms.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="p-2.5 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">01 // RHYTHM PADS</div>
            <div className="text-xs text-white/60 mt-0.5">Pulse-timed high velocity launch pads</div>
          </div>
          <div className="p-2.5 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-pink-400 font-bold tracking-wider uppercase">02 // SHIFT GATES</div>
            <div className="text-xs text-white/60 mt-0.5">Colossal labyrinth sliding wire barriers</div>
          </div>
          <div className="p-2.5 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">03 // PHASE TILES</div>
            <div className="text-xs text-white/60 mt-0.5">Platforms toggling on odd/even beats</div>
          </div>
          <div className="p-2.5 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">04 // CHECKPOINTS</div>
            <div className="text-xs text-white/60 mt-0.5">Multi-sector neon restore beacons</div>
          </div>
        </div>

        {/* Action Controls & Difficulty */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
          {/* Primary CTA */}
          <button
            onClick={onStart}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-mono font-bold tracking-widest text-sm hover:bg-cyan-300 transition-all cursor-pointer shadow-[0_0_25px_rgba(255,255,255,0.4)] active:scale-95"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>INITIALIZE RUN [SPACE / ENTER]</span>
          </button>

          {/* Difficulty selector */}
          <div className="flex items-center border border-white/20 bg-black/80 font-mono text-xs">
            <span className="px-3 text-white/40 border-r border-white/10">MODE:</span>
            {(['zen', 'standard', 'hyper'] as GameDifficulty[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetDifficulty(mode)}
                className={`px-3 py-2 uppercase transition-colors cursor-pointer ${
                  difficulty === mode
                    ? 'bg-cyan-400 text-black font-bold'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flat Control Hint Line mandated by game craft guidelines */}
      <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between font-mono text-xs text-white/50">
        <div className="tracking-wider">
          WASD Move · Space Jump · Shift Dash · Left-Click Pulse · Esc Pause · M Mute
        </div>
        <div className="tracking-widest uppercase text-white/30 text-[10px] mt-1 sm:mt-0">
          60FPS KINEMATIC SIMULATION // PROCEDURAL THREE.JS
        </div>
      </div>
    </div>
  );
};
