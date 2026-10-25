import React, { useEffect, useState } from 'react';
import { PlayerStats, GameSettings } from '../types';
import { soundSynth } from '../audio/SoundSynth';
import { Volume2, VolumeX, Crosshair, Zap, Shield, Sparkles, Maximize, Minimize } from 'lucide-react';

interface HUDOverlayProps {
  stats: PlayerStats;
  settings: GameSettings;
  onToggleMute: () => void;
  onPause: () => void;
  bannerNotification: string | null;
  isTouchControls?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  stats,
  settings,
  onToggleMute,
  bannerNotification,
  isTouchControls = false,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  // Local state for smooth beat indicator
  const [beatPhase, setBeatPhase] = useState(0);
  const [isNearBeat, setIsNearBeat] = useState(false);

  useEffect(() => {
    let frameId: number;
    const updateBeat = () => {
      const beatInfo = soundSynth.getBeatProgress();
      setBeatPhase(beatInfo.phase);
      setIsNearBeat(beatInfo.isNearBeat);
      frameId = requestAnimationFrame(updateBeat);
    };
    frameId = requestAnimationFrame(updateBeat);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Format time MM:SS.ms
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const sectorColors = ['#00f0ff', '#00f0ff', '#ff007f', '#ffaa00', '#00ff96'];
  const activeColor = sectorColors[Math.min(sectorColors.length - 1, stats.currentSector)];

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-5">
      {/* Top Bar Status Clusters */}
      <div className="flex items-start justify-between w-full">
        {/* Top Left: Timer & Sector Indicator */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-white/20">
            <span className="text-[10px] tracking-widest text-white/50 uppercase font-mono">TIMER</span>
            <span className="text-xl font-mono font-bold tracking-wider text-white tabular-nums wire-glow-white">
              {formatTime(stats.elapsedTime)}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 text-xs font-mono text-white/70">
            <span className="text-[10px] text-white/40">SECTOR</span>
            <span className="text-white font-semibold" style={{ color: activeColor }}>
              0{stats.currentSector} / 04
            </span>
          </div>

          {/* Compact Mobile Gauges */}
          {isTouchControls && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-2 px-2 py-0.5 bg-black/80 border border-cyan-400/40 text-[10px] font-mono">
                <Shield className="w-2.5 h-2.5 text-cyan-400" />
                <span className="text-white/60">INTEGRITY:</span>
                <span className="text-cyan-400 font-bold">{Math.round(stats.health)}%</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-0.5 bg-black/80 border border-amber-400/40 text-[10px] font-mono">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-white/60">DASH:</span>
                <span className="text-amber-400 font-bold">
                  {stats.dashCharge >= 95 ? 'READY' : `${Math.round(stats.dashCharge)}%`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Top Center: 120 BPM Rhythmic Pulse Metronome & Beat Streak */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 px-4 py-1.5 bg-black/75 border border-white/20">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((step) => {
                const isStepActive = Math.floor(beatPhase * 4) === step;
                return (
                  <div
                    key={step}
                    className="w-2.5 h-2.5 border transition-all duration-75"
                    style={{
                      borderColor: isStepActive ? activeColor : 'rgba(255,255,255,0.2)',
                      backgroundColor: isStepActive ? activeColor : 'transparent',
                      transform: isStepActive && isNearBeat ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: isStepActive ? `0 0 8px ${activeColor}` : 'none',
                    }}
                  />
                );
              })}
            </div>
            <div className="h-4 w-[1px] bg-white/20" />
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[10px] tracking-wider text-white/40">BEAT COMBO</span>
              <span
                className="font-bold tabular-nums transition-all"
                style={{
                  color: stats.beatCombo > 0 ? activeColor : 'rgba(255,255,255,0.4)',
                  textShadow: stats.beatCombo > 0 ? `0 0 10px ${activeColor}` : 'none',
                }}
              >
                x{Math.max(1, stats.beatCombo)}
              </span>
            </div>
          </div>

          {/* Rhythmic timing feedback label */}
          {isNearBeat && stats.beatCombo > 0 && (
            <div
              className="text-[10px] font-mono tracking-widest uppercase font-bold transition-opacity"
              style={{ color: activeColor }}
            >
              • ON BEAT CADENCE •
            </div>
          )}
        </div>

        {/* Top Right: Chronocubes & Score */}
        <div className="flex flex-col items-end gap-1 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] tracking-widest text-white/50 uppercase font-mono">CHRONO CUBES</span>
            <span className="text-sm font-mono font-bold text-white tabular-nums">
              {stats.cubesCollected} / {stats.totalCubes}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 text-xs font-mono">
            <span className="text-[10px] text-white/40">SCORE</span>
            <span className="text-white font-bold tabular-nums">
              {stats.score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Checkpoint Announcement Banner */}
      {bannerNotification && (
        <div className="self-center flex flex-col items-center justify-center animate-bounce">
          <div
            className="px-6 py-2 bg-black/90 border font-mono tracking-widest text-sm uppercase font-bold"
            style={{
              borderColor: activeColor,
              color: activeColor,
              boxShadow: `0 0 20px ${activeColor}40`,
            }}
          >
            CHECKPOINT ENGAGED: {bannerNotification}
          </div>
        </div>
      )}

      {/* Center Reticle: Wireframe FPS Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        {/* Minimal wireframe crosshair */}
        <div className="relative w-7 h-7 flex items-center justify-center">
          {/* Outer wire ring */}
          <div
            className="w-5 h-5 border rounded-full transition-transform duration-100"
            style={{
              borderColor: isNearBeat ? activeColor : 'rgba(255, 255, 255, 0.4)',
              transform: isNearBeat ? 'scale(1.15)' : 'scale(1)',
              boxShadow: isNearBeat ? `0 0 8px ${activeColor}` : 'none',
            }}
          />
          {/* Center pip */}
          <div className="absolute w-1 h-1 bg-white" />
          {/* Wire ticks */}
          <div className="absolute top-0 w-[1px] h-1.5 bg-white/70" />
          <div className="absolute bottom-0 w-[1px] h-1.5 bg-white/70" />
          <div className="absolute left-0 h-[1px] w-1.5 bg-white/70" />
          <div className="absolute right-0 h-[1px] w-1.5 bg-white/70" />
        </div>
      </div>

      {/* Bottom Bar Status Clusters */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom Left: Integrity (Health) & Dash Charge (Desktop only) */}
        {!isTouchControls && (
          <div className="flex flex-col gap-2 pointer-events-auto">
            {/* Integrity Bar */}
            <div className="flex flex-col gap-1 p-2 bg-black/75 border border-white/20 min-w-[200px]">
              <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                <span className="flex items-center gap-1 text-white/60">
                  <Shield className="w-3 h-3 text-cyan-400" /> INTEGRITY
                </span>
                <span className="font-bold text-white tabular-nums">
                  {Math.round(stats.health)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${(stats.health / stats.maxHealth) * 100}%`,
                    backgroundColor: stats.health > 40 ? '#00f0ff' : '#ff0055',
                    boxShadow: stats.health > 40 ? '0 0 8px #00f0ff' : '0 0 8px #ff0055',
                  }}
                />
              </div>
            </div>

            {/* Dash Capacitor */}
            <div className="flex flex-col gap-1 p-2 bg-black/75 border border-white/20 min-w-[200px]">
              <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                <span className="flex items-center gap-1 text-white/60">
                  <Zap className="w-3 h-3 text-amber-400" /> DASH CAPACITOR [SHIFT]
                </span>
                <span className="font-bold text-white tabular-nums">
                  {stats.dashCharge >= 95 ? 'READY' : `${Math.round(stats.dashCharge)}%`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${(stats.dashCharge / stats.maxDashCharge) * 100}%`,
                    backgroundColor: stats.dashCharge >= 95 ? '#ffaa00' : 'rgba(255, 170, 0, 0.4)',
                    boxShadow: stats.dashCharge >= 95 ? '0 0 8px #ffaa00' : 'none',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {isTouchControls && <div />}

        {/* Bottom Right: Audio Mute & Controls Reminder */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-white/10 text-[11px] font-mono text-white/50">
            <span>[WASD] MOVE</span>
            <span>•</span>
            <span>[SPACE] JUMP</span>
            <span>•</span>
            <span>[SHIFT] DASH</span>
            <span>•</span>
            <span>[CLICK] PULSE</span>
            <span>•</span>
            <span>[ESC] PAUSE</span>
          </div>

          {/* Fullscreen button */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex items-center justify-center w-9 h-9 bg-black/80 border border-white/30 text-white/80 hover:text-white hover:border-cyan-400 transition-colors cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 text-cyan-400" /> : <Maximize className="w-4 h-4 text-cyan-400" />}
            </button>
          )}

          {/* Mute button */}
          <button
            onClick={onToggleMute}
            className="flex items-center justify-center w-9 h-9 bg-black/80 border border-white/30 text-white/80 hover:text-white hover:border-white transition-colors cursor-pointer"
            title="Toggle Audio (M)"
          >
            {settings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>
    </div>
  );
};
