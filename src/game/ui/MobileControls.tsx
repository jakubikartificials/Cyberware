import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowUp, Zap, Crosshair, Pause, Maximize, Minimize, Camera } from 'lucide-react';

interface MobileControlsProps {
  onMove: (analogX: number, analogZ: number) => void;
  onLook: (deltaX: number, deltaY: number) => void;
  onJump: () => void;
  onDash: () => void;
  onPulse: () => void;
  onPause: () => void;
  dashCharge: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  cameraMode?: 'first' | 'third';
  onToggleCamera?: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMove,
  onLook,
  onJump,
  onDash,
  onPulse,
  onPause,
  dashCharge,
  isFullscreen = false,
  onToggleFullscreen,
  cameraMode = 'third',
  onToggleCamera,
}) => {
  // Joystick state
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch look state
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxRadius = 45; // max joystick knob travel in pixels

  // Handle Joystick Touch
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;

    if (joystickContainerRef.current) {
      const rect = joystickContainerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      joystickCenterRef.current = { x: centerX, y: centerY };

      const dx = touch.clientX - centerX;
      const dy = touch.clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxRadius);

      const kx = Math.cos(angle) * clampedDist;
      const ky = Math.sin(angle) * clampedDist;

      setKnobPos({ x: kx, y: ky });
      setIsJoystickActive(true);
      onMove(kx / maxRadius, ky / maxRadius);
    }
  };

  const handleJoystickTouchMove = useCallback((e: TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        const dx = touch.clientX - joystickCenterRef.current.x;
        const dy = touch.clientY - joystickCenterRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(dist, maxRadius);

        const kx = Math.cos(angle) * clampedDist;
        const ky = Math.sin(angle) * clampedDist;

        setKnobPos({ x: kx, y: ky });
        onMove(kx / maxRadius, ky / maxRadius);
        break;
      }
    }
  }, [onMove]);

  const handleJoystickTouchEnd = useCallback((e: TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setKnobPos({ x: 0, y: 0 });
        setIsJoystickActive(false);
        onMove(0, 0);
        break;
      }
    }
  }, [onMove]);

  // Handle Touch Look on Right Side
  const handleLookTouchStart = (e: React.TouchEvent) => {
    // If we're already tracking a look touch, ignore
    if (lookTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = useCallback((e: TouchEvent) => {
    if (lookTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const deltaX = touch.clientX - lastLookPosRef.current.x;
        const deltaY = touch.clientY - lastLookPosRef.current.y;
        lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };

        // Scale touch look delta for smooth responsiveness
        onLook(deltaX * 1.6, deltaY * 1.6);
        break;
      }
    }
  }, [onLook]);

  const handleLookTouchEnd = useCallback((e: TouchEvent) => {
    if (lookTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  }, []);

  // Global window touchmove and touchend listeners
  useEffect(() => {
    window.addEventListener('touchmove', handleJoystickTouchMove, { passive: false });
    window.addEventListener('touchend', handleJoystickTouchEnd);
    window.addEventListener('touchcancel', handleJoystickTouchEnd);

    window.addEventListener('touchmove', handleLookTouchMove, { passive: false });
    window.addEventListener('touchend', handleLookTouchEnd);
    window.addEventListener('touchcancel', handleLookTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleJoystickTouchMove);
      window.removeEventListener('touchend', handleJoystickTouchEnd);
      window.removeEventListener('touchcancel', handleJoystickTouchEnd);

      window.removeEventListener('touchmove', handleLookTouchMove);
      window.removeEventListener('touchend', handleLookTouchEnd);
      window.removeEventListener('touchcancel', handleLookTouchEnd);
    };
  }, [handleJoystickTouchMove, handleJoystickTouchEnd, handleLookTouchMove, handleLookTouchEnd]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between overflow-hidden">
      {/* Top Touch Controls Header: Pause, Camera, and Fullscreen Buttons for mobile users */}
      <div className="flex items-center justify-between p-4 pointer-events-auto">
        <button
          onClick={onPause}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 border border-white/30 text-white font-mono text-xs hover:border-cyan-400 hover:text-cyan-400 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,0,0,0.8)]"
        >
          <Pause className="w-3.5 h-3.5" />
          <span>PAUSE</span>
        </button>

        <div className="flex items-center gap-2">
          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className="flex items-center gap-1 px-3 py-1.5 bg-black/80 border border-orange-500/70 text-orange-400 font-mono text-xs hover:border-orange-300 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(255,119,0,0.3)]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{cameraMode === 'third' ? '3P SPIDER' : '1P COCKPIT'}</span>
            </button>
          )}

          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 border border-white/30 text-white font-mono text-xs hover:border-cyan-400 hover:text-cyan-400 active:scale-95 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,0,0,0.8)]"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-cyan-400" /> : <Maximize className="w-3.5 h-3.5 text-cyan-400" />}
              <span className="hidden sm:inline">{isFullscreen ? 'EXIT' : 'FULL'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Touch Interaction Zone */}
      <div className="flex-1 w-full flex">
        {/* Left 45%: Reserved for joystick and thumb navigation */}
        <div className="w-[45%] h-full pointer-events-none" />

        {/* Right 55%: Touch-to-Look Swipe Surface */}
        <div
          onTouchStart={handleLookTouchStart}
          className="flex-1 h-full pointer-events-auto touch-none"
        />
      </div>

      {/* Bottom Controls Row: Virtual Joystick (Left) and Action Buttons (Right) */}
      <div className="p-5 pb-7 flex items-end justify-between w-full pointer-events-none">
        {/* Left Side: Virtual Analog Joystick */}
        <div className="pointer-events-auto touch-none flex flex-col items-center">
          <div
            ref={joystickContainerRef}
            onTouchStart={handleJoystickTouchStart}
            className="relative w-32 h-32 rounded-full border border-cyan-400/40 bg-black/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.15)]"
          >
            {/* Crosshairs inside joystick base */}
            <div className="absolute w-full h-[1px] bg-cyan-400/20" />
            <div className="absolute h-full w-[1px] bg-cyan-400/20" />
            <div className="w-12 h-12 rounded-full border border-cyan-400/20" />

            {/* Draggable Knob */}
            <div
              className={`absolute w-14 h-14 rounded-full border-2 transition-transform duration-75 flex items-center justify-center ${
                isJoystickActive
                  ? 'border-cyan-300 bg-cyan-400/30 shadow-[0_0_15px_#00f0ff]'
                  : 'border-cyan-400/70 bg-black/70'
              }`}
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            >
              <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
            </div>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-cyan-400/60 mt-1 uppercase">
            MOVE // THUMB
          </span>
        </div>

        {/* Right Side: Action Buttons Cluster */}
        <div className="pointer-events-auto flex items-end gap-3.5">
          {/* Action Column 1: Pulse and Dash */}
          <div className="flex flex-col gap-3 items-center">
            {/* Pulse Weapon Button */}
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onPulse();
              }}
              onClick={onPulse}
              className="w-13 h-13 rounded-full border border-pink-500 bg-black/70 flex flex-col items-center justify-center text-pink-400 active:scale-90 active:bg-pink-500/30 shadow-[0_0_12px_rgba(255,0,128,0.3)] transition-transform cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
              <span className="text-[8px] font-mono font-bold tracking-tight mt-0.5">PULSE</span>
            </button>

            {/* Air Dash Button */}
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onDash();
              }}
              onClick={onDash}
              disabled={dashCharge < 90}
              className={`w-13 h-13 rounded-full border flex flex-col items-center justify-center transition-transform cursor-pointer active:scale-90 ${
                dashCharge >= 90
                  ? 'border-amber-400 bg-black/70 text-amber-400 shadow-[0_0_12px_rgba(255,170,0,0.3)]'
                  : 'border-white/20 bg-black/40 text-white/30 cursor-not-allowed'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="text-[8px] font-mono font-bold tracking-tight mt-0.5">DASH</span>
            </button>
          </div>

          {/* Action Column 2: Jump Button */}
          <div className="flex flex-col items-center">
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onJump();
              }}
              onClick={onJump}
              className="w-20 h-20 rounded-full border-2 border-white bg-white/10 flex flex-col items-center justify-center text-white active:scale-90 active:bg-white/30 shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-transform cursor-pointer"
            >
              <ArrowUp className="w-7 h-7 stroke-[2.5]" />
              <span className="text-[10px] font-mono font-black tracking-widest mt-0.5">JUMP</span>
            </button>
            <span className="text-[10px] font-mono tracking-widest text-white/50 mt-1 uppercase">
              ACTION
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
