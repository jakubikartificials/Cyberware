import React, { useState } from 'react';
import { GameDifficulty } from '../types';
import { Play, Volume2, VolumeX, Maximize, Minimize, Users, Bot, Globe, Copy, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface TitleScreenProps {
  onStart: () => void;
  difficulty: GameDifficulty;
  onSetDifficulty: (diff: GameDifficulty) => void;
  runnerCount: number;
  onSetRunnerCount: (count: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  bestTime: number | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  // 2-Player Online props
  onHostOnline: () => void;
  onJoinOnline: (code: string) => void;
  onlineRoomCode: string;
  isOnlineConnecting: boolean;
  onlineError: string | null;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  difficulty,
  onSetDifficulty,
  runnerCount,
  onSetRunnerCount,
  isMuted,
  onToggleMute,
  bestTime,
  isFullscreen,
  onToggleFullscreen,
  onHostOnline,
  onJoinOnline,
  onlineRoomCode,
  isOnlineConnecting,
  onlineError,
}) => {
  const [showMultiplayerModal, setShowMultiplayerModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = () => {
    if (onlineRoomCode) {
      navigator.clipboard.writeText(onlineRoomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-12 pointer-events-auto select-none bg-gradient-to-b from-black/60 via-transparent to-black/85">
      {/* Top Header: Audio, Offline & Fullscreen */}
      <div className="flex flex-wrap items-center justify-between w-full gap-3">
        <div className="flex items-center gap-2 border border-white/20 bg-black/60 px-3 py-1 font-mono text-xs tracking-widest text-white/70">
          <span className="w-2 h-2 bg-cyan-400 animate-pulse" />
          <span>MICRO-CRAWLER LABYRINTH // 120 BPM</span>
        </div>

        <div className="flex items-center gap-2.5">
          <PWAInstallButton />
          {bestTime !== null && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 border border-white/20 bg-black/60 font-mono text-xs">
              <span className="text-white/40">BEST RECORD:</span>
              <span className="text-emerald-400 font-bold tabular-nums">{formatTime(bestTime)}</span>
            </div>
          )}
          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1 border border-white/30 bg-black/70 font-mono text-xs text-white/80 hover:text-white hover:border-cyan-400 transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{isFullscreen ? 'WINDOWED' : 'FULLSCREEN'}</span>
          </button>
          <button
            onClick={onToggleMute}
            className="flex items-center gap-2 px-3 py-1 border border-white/30 bg-black/70 font-mono text-xs text-white/80 hover:text-white hover:border-white transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>AUDIO: {isMuted ? 'OFF' : 'ON'} [M]</span>
          </button>
        </div>
      </div>

      {/* Main Centerpiece */}
      <div className="my-auto max-w-2xl flex flex-col gap-5">
        <div className="space-y-2">
          {/* Logo Lockup */}
          <div className="flex items-center gap-4">
            <svg width="60" height="60" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <polygon points="32,4 58,18 58,46 32,60 6,46 6,18" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />
              <path d="M32 16 L50 26 L50 48 L32 58 L14 48 L14 26 Z" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
              <path d="M32 16 L32 38 M14 26 L32 38 M50 26 L32 38" stroke="#00f0ff" strokeWidth="1.5" />
              <circle cx="32" cy="38" r="3" fill="#ff007f" />
            </svg>
            <div>
              <div className="font-mono text-xs tracking-widest text-cyan-400 font-bold uppercase">
                FIRST-PERSON MICRO-CRAWLER LABYRINTH
              </div>
              <h1 className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white wire-glow-white uppercase">
                CYBERWIRE
              </h1>
            </div>
          </div>

          <p className="font-mono text-xs sm:text-sm text-white/70 max-w-xl leading-relaxed">
            Scaled 4x smaller into a towering cybernetic megastructure. Walk on walls, scale vertical shafts, deploy temporary pulse nets to trap enemies and alter level dispositions, and conquer rotating cog platforms to extract the Prismatic Core.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="p-2 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">01 // WALL WALKING</div>
            <div className="text-[11px] text-white/60 mt-0.5">Magnetic crawler grip on all vertical walls</div>
          </div>
          <div className="p-2 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-pink-400 font-bold tracking-wider uppercase">02 // PULSE NETS</div>
            <div className="text-[11px] text-white/60 mt-0.5">Barrier nets that trap bots & shift map layouts</div>
          </div>
          <div className="p-2 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">03 // ROTATING COGS</div>
            <div className="text-[11px] text-white/60 mt-0.5">Massive spinning hex platforms over void pits</div>
          </div>
          <div className="p-2 bg-black/60 border border-white/10 font-mono">
            <div className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">04 // 2P ONLINE</div>
            <div className="text-[11px] text-white/60 mt-0.5">Real-time WebRTC 2-player co-op / race</div>
          </div>
        </div>

        {/* Character Avatar & Bot Runners Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-black/80 border border-white/20 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider pr-2 border-r border-white/10">
            <Bot className="w-4 h-4 text-orange-400" />
            <span className="text-white">AVATAR:</span>
            <span className="text-orange-400">MICRO SPIDER (4X SCALE)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/50 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" /> BOTS:
            </span>
            <div className="flex border border-white/20 bg-black/90">
              {[
                { count: 1, label: '1 SOLO' },
                { count: 2, label: '2 DUO' },
                { count: 4, label: '4 SQUAD' },
                { count: 8, label: '8 SWARM' },
              ].map((item) => (
                <button
                  key={item.count}
                  onClick={() => onSetRunnerCount(item.count)}
                  className={`px-2 py-0.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                    runnerCount === item.count
                      ? 'bg-orange-500 text-black shadow-[0_0_10px_#ff7700]'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2-Player Online Button */}
          <button
            onClick={() => setShowMultiplayerModal(true)}
            className="sm:ml-auto flex items-center justify-center gap-2 px-3 py-1.5 bg-pink-500/20 border border-pink-500 text-pink-300 font-bold hover:bg-pink-500 hover:text-black transition-all cursor-pointer shadow-[0_0_15px_rgba(255,0,128,0.3)]"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>2 PLAYERS ONLINE</span>
          </button>
        </div>

        {/* Action Controls & Difficulty */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          {/* Primary CTA */}
          <button
            onClick={onStart}
            className="flex items-center justify-center gap-3 px-8 py-3.5 bg-white text-black font-mono font-bold tracking-widest text-sm hover:bg-cyan-300 transition-all cursor-pointer shadow-[0_0_25px_rgba(255,255,255,0.4)] active:scale-95"
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

      {/* Online 2-Player Modal */}
      {showMultiplayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-md p-6 bg-black border border-pink-500/60 font-mono shadow-[0_0_50px_rgba(255,0,128,0.3)] flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <div className="flex items-center gap-2 text-pink-400 font-bold text-sm">
                <Globe className="w-4 h-4" />
                <span>ONLINE 2-PLAYER PEER-TO-PEER</span>
              </div>
              <button
                onClick={() => setShowMultiplayerModal(false)}
                className="text-white/40 hover:text-white text-xs cursor-pointer"
              >
                [CLOSE]
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Connect 2 players in real-time over low-latency WebRTC. Host a match or enter a friend's Room Code to race, climb walls, and lay pulse nets together!
            </p>

            {onlineError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-500/80 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{onlineError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Host */}
              <div className="p-4 bg-white/5 border border-white/20 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-cyan-400 font-bold text-xs uppercase">HOST MATCH</div>
                  <div className="text-[11px] text-white/50 mt-1">Generate a Room Code for Player 2 to join.</div>
                </div>

                {onlineRoomCode ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-2 bg-black border border-cyan-400 text-cyan-400 text-lg font-bold tracking-widest text-center">
                      <span>{onlineRoomCode}</span>
                      <button onClick={handleCopyCode} className="text-white/60 hover:text-white cursor-pointer" title="Copy Code">
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-[10px] text-amber-400 animate-pulse text-center">
                      WAITING FOR PLAYER 2...
                    </div>
                    <button
                      onClick={onStart}
                      className="w-full py-2 bg-cyan-400 text-black font-bold text-xs uppercase cursor-pointer hover:bg-cyan-300"
                    >
                      ENTER LABYRINTH
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onHostOnline}
                    disabled={isOnlineConnecting}
                    className="w-full py-2.5 bg-cyan-400 text-black font-bold text-xs uppercase hover:bg-cyan-300 transition-colors cursor-pointer"
                  >
                    {isOnlineConnecting ? 'GENERATING...' : 'CREATE ROOM'}
                  </button>
                )}
              </div>

              {/* Option B: Join */}
              <div className="p-4 bg-white/5 border border-white/20 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-pink-400 font-bold text-xs uppercase">JOIN MATCH</div>
                  <div className="text-[11px] text-white/50 mt-1">Enter your friend's 4-character Room Code.</div>
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="ROOM CODE"
                    className="w-full p-2 bg-black border border-white/30 text-white font-mono text-center tracking-widest uppercase text-sm focus:border-pink-400 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (joinCodeInput.trim().length >= 3) {
                        onJoinOnline(joinCodeInput.trim());
                      }
                    }}
                    disabled={joinCodeInput.trim().length < 3 || isOnlineConnecting}
                    className="w-full py-2.5 bg-pink-500 text-black font-bold text-xs uppercase hover:bg-pink-400 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {isOnlineConnecting ? 'CONNECTING...' : 'JOIN ROOM'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flat Control Hint Line */}
      <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between font-mono text-xs text-white/50">
        <div className="tracking-wider">
          WASD Move · Space Jump / Wall Leap · Shift Dash · [E / Right-Click] Pulse Net · [F / Left-Click] Fire Pulse
        </div>
        <div className="tracking-widest uppercase text-white/30 text-[10px] mt-1 sm:mt-0">
          MICRO CRAWLER 4X SCALE // COCKPIT VIEW // 60FPS THREE.JS
        </div>
      </div>
    </div>
  );
};
