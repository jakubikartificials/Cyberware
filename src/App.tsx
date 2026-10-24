/**
 * CYBERWIRE: Maze Runner 3D
 * Low-poly wireframe first-person labyrinth runner with rhythmic platforming and neon checkpoints
 * @license Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { WireScene } from './game/rendering/WireScene';
import { GameDifficulty, GameSettings, GameState, PlayerStats } from './game/types';
import { soundSynth } from './game/audio/SoundSynth';
import { TitleScreen } from './game/ui/TitleScreen';
import { HUDOverlay } from './game/ui/HUDOverlay';
import { PauseModal } from './game/ui/PauseModal';
import { VictoryModal } from './game/ui/VictoryModal';
import { GameOverModal } from './game/ui/GameOverModal';
import { useOnlineStatus } from './game/pwa/useOnlineStatus';
import { WifiOff } from 'lucide-react';

const INITIAL_STATS: PlayerStats = {
  health: 100,
  maxHealth: 100,
  dashCharge: 100,
  maxDashCharge: 100,
  pulseEnergy: 100,
  maxPulseEnergy: 100,
  cubesCollected: 0,
  totalCubes: 6,
  currentSector: 1,
  totalSectors: 4,
  checkpointName: 'VECTOR INITIATION',
  elapsedTime: 0,
  beatCombo: 0,
  maxBeatCombo: 0,
  beatAccuracyPct: 100,
  score: 0,
};

const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.2,
  soundVolume: 0.8,
  musicVolume: 0.5,
  muted: false,
  invertY: false,
  fov: 75,
  showScanlines: true,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const wireSceneRef = useRef<WireScene | null>(null);

  const [gameState, setGameState] = useState<GameState>('title');
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('standard');
  const [bannerNotification, setBannerNotification] = useState<string | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

  // Best speedrun record from localStorage
  const [bestTime, setBestTime] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('cyberwire_best_time');
      return stored ? parseFloat(stored) : null;
    } catch {
      return null;
    }
  });

  const [isNewBest, setIsNewBest] = useState(false);
  const isOnline = useOnlineStatus();

  // Initialize Three.js scene once on mount
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const scene = new WireScene(
      canvasMountRef.current,
      settings,
      { ...INITIAL_STATS },
      {
        onStatsUpdate: (updatedStats) => {
          setStats({ ...updatedStats });
        },
        onStateTransition: (newState) => {
          setGameState(newState);
          if (newState === 'victory') {
            // Check record
            const currentRecord = bestTime;
            if (currentRecord === null || stats.elapsedTime < currentRecord) {
              setBestTime(stats.elapsedTime);
              setIsNewBest(true);
              try {
                localStorage.setItem('cyberwire_best_time', stats.elapsedTime.toString());
              } catch {
                // Ignore storage error
              }
            } else {
              setIsNewBest(false);
            }
          }
        },
      }
    );

    wireSceneRef.current = scene;

    return () => {
      scene.dispose();
      wireSceneRef.current = null;
    };
  }, []);

  // Listen to checkpoint announcements
  useEffect(() => {
    if (!wireSceneRef.current) return;

    wireSceneRef.current.player.onCheckpointActivated = (name, sector) => {
      setStats((prev) => ({
        ...prev,
        checkpointName: name,
        currentSector: sector,
      }));

      // Show checkpoint announcement banner
      setBannerNotification(name);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = window.setTimeout(() => {
        setBannerNotification(null);
      }, 3500);
    };
  }, []);

  // Apply difficulty adjustments
  const handleSetDifficulty = (diff: GameDifficulty) => {
    setDifficulty(diff);
    if (!wireSceneRef.current) return;
    if (diff === 'zen') {
      wireSceneRef.current.mazeData.lasers.forEach(l => l.damage = 0);
    } else if (diff === 'hyper') {
      wireSceneRef.current.mazeData.lasers.forEach(l => l.damage = 40);
    } else {
      wireSceneRef.current.mazeData.lasers.forEach(l => l.damage = 25);
    }
  };

  const handleStartGame = () => {
    if (!wireSceneRef.current) return;
    wireSceneRef.current.startGame();
    setGameState('playing');
  };

  const handleResume = () => {
    if (!wireSceneRef.current) return;
    wireSceneRef.current.gameState = 'playing';
    setGameState('playing');
    wireSceneRef.current.requestPointerLock();
  };

  const handleRespawn = () => {
    if (!wireSceneRef.current) return;
    wireSceneRef.current.respawnPlayer();
    setGameState('playing');
  };

  const handleRestartSector = () => {
    if (!wireSceneRef.current) return;
    wireSceneRef.current.restartSector();
    setGameState('playing');
  };

  const handleRestartGame = () => {
    if (!wireSceneRef.current) return;
    wireSceneRef.current.restartGame();
    setGameState('playing');
  };

  const handleQuitTitle = () => {
    if (!wireSceneRef.current) return;
    wireSceneRef.current.gameState = 'title';
    setGameState('title');
    soundSynth.stopMusic();
    document.exitPointerLock?.();
  };

  const handleToggleMute = () => {
    const isMuted = soundSynth.toggleMute();
    setSettings(prev => ({ ...prev, muted: isMuted }));
    if (wireSceneRef.current) {
      wireSceneRef.current.settings.muted = isMuted;
    }
  };

  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings };
      if (wireSceneRef.current) {
        wireSceneRef.current.settings = merged;
      }
      return merged;
    });
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black select-none"
      onClick={() => {
        if (gameState === 'title' || gameState === 'playing') {
          wireSceneRef.current?.handleCanvasClick();
        }
      }}
      onMouseMove={(e) => {
        wireSceneRef.current?.handleMouseMove(e.nativeEvent);
      }}
    >
      {/* Isolated Three.js Canvas Container: Never re-rendered by React state updates */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-crosshair z-0" />

      {/* Subtle Retro Scanline Overlay (pure pointer-events-none) */}
      {settings.showScanlines && (
        <div className="absolute inset-0 pointer-events-none crt-grid opacity-35 z-[1]" />
      )}

      {/* Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/90 border border-amber-500/60 font-mono text-xs text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
          <WifiOff className="w-3.5 h-3.5" />
          <span>OFFLINE MODE // RUNNING FROM LOCAL CACHE</span>
        </div>
      )}

      {/* UI States */}
      {gameState === 'title' && (
        <TitleScreen
          onStart={handleStartGame}
          difficulty={difficulty}
          onSetDifficulty={handleSetDifficulty}
          isMuted={settings.muted}
          onToggleMute={handleToggleMute}
          bestTime={bestTime}
        />
      )}

      {gameState === 'playing' && (
        <HUDOverlay
          stats={stats}
          settings={settings}
          onToggleMute={handleToggleMute}
          onPause={() => {
            if (wireSceneRef.current) {
              wireSceneRef.current.gameState = 'paused';
              setGameState('paused');
              document.exitPointerLock?.();
            }
          }}
          bannerNotification={bannerNotification}
        />
      )}

      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRespawn={handleRespawn}
          onRestartSector={handleRestartSector}
          onRestartGame={handleRestartGame}
          onQuitTitle={handleQuitTitle}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          stats={stats}
        />
      )}

      {gameState === 'victory' && (
        <VictoryModal
          stats={stats}
          onPlayAgain={handleRestartGame}
          onQuitTitle={handleQuitTitle}
          isNewBest={isNewBest}
        />
      )}

      {gameState === 'gameover' && (
        <GameOverModal
          stats={stats}
          onRespawn={handleRespawn}
          onRestartSector={handleRestartSector}
          onQuitTitle={handleQuitTitle}
        />
      )}
    </div>
  );
}
