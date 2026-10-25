import React from 'react';
import { GameSettings, PlayerStats } from '../types';
import { Play, RotateCcw, Home, Volume2, VolumeX, Eye, Gauge, Smartphone, Maximize, Minimize } from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface PauseModalProps {
  onResume: () => void;
  onRespawn: () => void;
  onRestartSector: () => void;
  onRestartGame: () => void;
  onQuitTitle: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  stats: PlayerStats;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRespawn,
  onRestartSector,
  onRestartGame,
  onQuitTitle,
  settings,
  onUpdateSettings,
  stats,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/85 select-none pointer-events-auto">
      <div className="w-full max-w-md p-6 bg-black border border-white/30 flex flex-col gap-6 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/20 pb-4">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase font-bold">
              SIMULATION SUSPENDED
            </div>
            <h2 className="text-2xl font-mono font-bold tracking-wider text-white">PAUSED</h2>
          </div>
          <div className="text-right font-mono text-xs text-white/60">
            <div>SECTOR 0{stats.currentSector}</div>
            <div className="text-cyan-400 font-semibold">{stats.checkpointName}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 font-mono text-xs font-semibold">
          <button
            onClick={onResume}
            className="flex items-center justify-between p-3 bg-white text-black hover:bg-cyan-300 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Play className="w-4 h-4 fill-black" /> RESUME SIMULATION
            </span>
            <span className="text-[10px] text-black/60">[ESC]</span>
          </button>

          <button
            onClick={onRespawn}
            className="flex items-center justify-between p-3 bg-black border border-white/20 text-white hover:border-cyan-400 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> RESPAWN AT CHECKPOINT
            </span>
            <span className="text-[10px] text-white/40">RESTORE</span>
          </button>

          <button
            onClick={onRestartSector}
            className="flex items-center justify-between p-3 bg-black border border-white/20 text-white hover:border-pink-400 hover:text-pink-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> RESTART SECTOR
            </span>
            <span className="text-[10px] text-white/40">SECTOR 0{stats.currentSector}</span>
          </button>

          <button
            onClick={onRestartGame}
            className="flex items-center justify-between p-3 bg-black border border-white/20 text-white hover:border-amber-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> RESTART FULL RUN
            </span>
            <span className="text-[10px] text-white/40">FROM START</span>
          </button>

          <button
            onClick={onQuitTitle}
            className="flex items-center justify-between p-3 bg-black border border-white/20 text-white hover:border-rose-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Home className="w-4 h-4" /> EXIT TO TITLE SCREEN
            </span>
            <span className="text-[10px] text-white/40">MENU</span>
          </button>
        </div>

        {/* Offline PWA Installation */}
        <div className="flex justify-center border-t border-white/10 pt-2">
          <PWAInstallButton />
        </div>

        {/* Quick Settings */}
        <div className="border-t border-white/20 pt-4 flex flex-col gap-3 font-mono text-xs">
          <div className="text-[10px] tracking-widest text-white/50 uppercase">CONFIGURATIONS</div>

          {/* Mouse Sensitivity */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white/70">
              <Gauge className="w-3.5 h-3.5" /> MOUSE SENSITIVITY
            </span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={settings.mouseSensitivity}
              onChange={(e) => onUpdateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
              className="w-32 accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Field of View */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white/70">
              <Eye className="w-3.5 h-3.5" /> FIELD OF VIEW ({settings.fov}°)
            </span>
            <input
              type="range"
              min="65"
              max="95"
              step="5"
              value={settings.fov}
              onChange={(e) => onUpdateSettings({ fov: parseInt(e.target.value) })}
              className="w-32 accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Touch Controls Toggle */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-white/70">
              <Smartphone className="w-3.5 h-3.5" /> TOUCH CONTROLS
            </span>
            <div className="flex border border-white/20 bg-black text-[10px]">
              {(['auto', 'on', 'off'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateSettings({ touchControls: mode })}
                  className={`px-2 py-0.5 uppercase cursor-pointer ${
                    settings.touchControls === mode
                      ? 'bg-cyan-400 text-black font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-white/70">
                {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize className="w-3.5 h-3.5 text-cyan-400" />}
                DISPLAY MODE
              </span>
              <button
                onClick={onToggleFullscreen}
                className="px-3 py-1 border border-white/20 hover:border-cyan-400 text-xs text-cyan-400 cursor-pointer"
              >
                {isFullscreen ? 'EXIT FULLSCREEN' : 'GO FULLSCREEN'}
              </button>
            </div>
          )}

          {/* Audio Mute */}
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-2 text-white/70">
              {settings.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
              AUDIO SOUNDTRACK
            </span>
            <button
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className="px-3 py-1 border border-white/20 hover:border-white text-xs cursor-pointer"
            >
              {settings.muted ? 'UNMUTE [M]' : 'MUTE [M]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
