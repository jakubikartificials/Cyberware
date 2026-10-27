import React, { useEffect, useState } from 'react';
import { PlayerStats, GameSettings, MultiplayerPlayerState } from '../types';
import { soundSynth } from '../audio/SoundSynth';
import { Volume2, VolumeX, Shield, Sparkles, Maximize, Minimize, Compass, Radio, Grid } from 'lucide-react';

interface HUDOverlayProps {
  stats: PlayerStats;
  settings: GameSettings;
  onToggleMute: () => void;
  onPause: () => void;
  bannerNotification: string | null;
  isTouchControls?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isWallWalking?: boolean;
  pulseNetCooldown?: number;
  isMultiplayerConnected?: boolean;
  multiplayerPing?: number;
  remotePlayerState?: MultiplayerPlayerState | null;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  stats,
  settings,
  onToggleMute,
  bannerNotification,
  isTouchControls = false,
  isFullscreen = false,
  onToggleFullscreen,
  isWallWalking = false,
  pulseNetCooldown = 0,
  isMultiplayerConnected = false,
  multiplayerPing = 0,
  remotePlayerState = null,
}) => {
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const sectorColors = ['#00f0ff', '#00f0ff', '#ffaa00', '#00ff96', '#ff007f', '#ffaa00', '#00f0ff'];
  const activeColor = sectorColors[Math.min(sectorColors.length - 1, stats.currentSector)];

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Bar Status Clusters */}
      <div className="flex items-start justify-between w-full">
        {/* Top Left: Timer, Sector & Gravity Indicator */}
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-white/20">
            <span className="text-[10px] tracking-widest text-white/50 uppercase font-mono">TIMER</span>
            <span className="text-xl font-mono font-bold tracking-wider text-white tabular-nums wire-glow-white">
              {formatTime(stats.elapsedTime)}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 text-xs font-mono text-white/70">
            <span className="text-[10px] text-white/40">LEVEL</span>
            <span className="text-white font-semibold" style={{ color: activeColor }}>
              0{stats.currentSector} / 06
            </span>
          </div>

          {/* Upside Down Inverted Gravity Indicator */}
          {stats.isGravityInverted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/80 border border-amber-400 font-mono text-[10px] text-amber-300 shadow-[0_0_14px_rgba(255,170,0,0.5)] animate-pulse">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">GRAVITY: INVERTED 🔄 [CEILING RUN]</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-black/60 border border-white/15 font-mono text-[9px] text-white/50">
              <Compass className="w-3 h-3 text-white/40" />
              <span>GRAVITY: NORMAL</span>
            </div>
          )}

          {/* 2-Player Online Status */}
          {isMultiplayerConnected && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-pink-950/80 border border-pink-500 font-mono text-[10px] text-pink-300 shadow-[0_0_12px_rgba(255,0,128,0.3)]">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span className="font-bold">P2 CONNECTED</span>
              <span className="text-white/60">({multiplayerPing}ms)</span>
              {remotePlayerState && (
                <span className="text-pink-400 font-bold ml-1">
                  SEC 0{remotePlayerState.checkpointSector}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Top Center: 120 BPM Rhythmic Metronome */}
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

      {/* Center Reticle: First-person Cockpit HUD Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div
            className="w-5 h-5 border rounded-full transition-transform duration-100"
            style={{
              borderColor: isNearBeat ? activeColor : 'rgba(255, 255, 255, 0.4)',
              transform: isNearBeat ? 'scale(1.15)' : 'scale(1)',
              boxShadow: isNearBeat ? `0 0 8px ${activeColor}` : 'none',
            }}
          />
          <div className="absolute w-1 h-1 bg-white" />
          <div className="absolute top-0 w-[1px] h-1.5 bg-white/70" />
          <div className="absolute bottom-0 w-[1px] h-1.5 bg-white/70" />
          <div className="absolute left-0 h-[1px] w-1.5 bg-white/70" />
          <div className="absolute right-0 h-[1px] w-1.5 bg-white/70" />
        </div>
      </div>

      {/* Bottom Bar: Health, Dash, Pulse Net & Controls */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom Left: Integrity, Dash, and Pulse Net Capacitors */}
        {!isTouchControls && (
          <div className="flex flex-col gap-2 pointer-events-auto">
            {/* Integrity Bar */}
            <div className="flex flex-col gap-1 p-2 bg-black/75 border border-white/20 min-w-[210px]">
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

            {/* Climbing Rope Status */}
            <div className={`flex flex-col gap-1 p-2 bg-black/75 border min-w-[220px] transition-all duration-150 ${
              stats.isPullingRope
                ? 'border-amber-400 shadow-[0_0_12px_rgba(255,170,0,0.4)]'
                : stats.isRopeAttached
                ? 'border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                : 'border-white/20'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                <span className="flex items-center gap-1 font-bold" style={{ color: stats.isPullingRope ? '#ffaa00' : stats.isRopeAttached ? '#00f0ff' : 'rgba(255,255,255,0.7)' }}>
                  <Grid className="w-3 h-3" />
                  {stats.isPullingRope
                    ? 'ROPE: REELING ASCENT'
                    : stats.isRopeAttached
                    ? 'ROPE: ANCHORED [CLIMB]'
                    : 'ROPE: CLIMBING TETHER'}
                </span>
                <span className="font-bold tabular-nums text-[9px]" style={{ color: stats.isPullingRope ? '#ffaa00' : stats.isRopeAttached ? '#00f0ff' : 'rgba(255,255,255,0.5)' }}>
                  {stats.isPullingRope ? 'PULLING ⚡' : stats.isRopeAttached ? 'PULL [R-CLICK]' : 'READY [R-CLICK]'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: stats.isPullingRope ? '100%' : stats.isRopeAttached ? '60%' : '100%',
                    backgroundColor: stats.isPullingRope ? '#ffaa00' : stats.isRopeAttached ? '#00f0ff' : '#44ffaa',
                    boxShadow: stats.isPullingRope ? '0 0 8px #ffaa00' : stats.isRopeAttached ? '0 0 8px #00f0ff' : 'none',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {isTouchControls && <div />}

        {/* Bottom Right: Controls Reminder & Fullscreen */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-black/70 border border-white/10 text-[11px] font-mono text-white/50">
            <span>[WASD] MOVE</span>
            <span>•</span>
            <span>[SPACE] JUMP / RELEASE ROPE</span>
            <span>•</span>
            <span className="text-amber-400 font-bold">[R-CLICK / E] FIRE ROPE / PULL</span>
            <span>•</span>
            <span className="text-cyan-400">[L-CLICK / F] PULSE</span>
            <span>•</span>
            <span>[SHIFT] DASH</span>
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
