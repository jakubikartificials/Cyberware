export type GameState = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type GameDifficulty = 'zen' | 'standard' | 'hyper';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  sectorIndex: number;
  position: [number, number, number];
  color: string; // hex string e.g. '#00f0ff'
  colorHex: number; // e.g. 0x00f0ff
  activated: boolean;
  radius: number;
}

export interface RhythmicJumpPad {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  power: number;
  direction?: [number, number, number]; // launch vector if directional
  lastTriggeredTime?: number;
}

export interface PhasePlatform {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  phase: 'odd' | 'even'; // odd beats or even beats
  colorHex: number;
  active: boolean;
}

export interface ShiftingGate {
  id: string;
  position: [number, number, number];
  size: [number, number, number]; // [width, height, depth]
  openOffset: number; // how high or to the side it opens
  direction: 'up' | 'x' | 'z';
  isOpen: boolean;
  cycleIntervalSeconds: number; // e.g. 4 beats or 8 beats
  phaseOffsetSeconds: number;
  wireColorHex: number;
}

export interface RhythmicLaser {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  activeBeats: number[]; // e.g. active on beats [1, 2]
  colorHex: number;
  damage: number;
}

export interface Chronocube {
  id: string;
  position: [number, number, number];
  collected: boolean;
  colorHex: number;
}

export interface SwitchTarget {
  id: string;
  position: [number, number, number];
  radius: number;
  activated: boolean;
  colorHex: number;
  linkedGateId?: string;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  dashCharge: number;
  maxDashCharge: number;
  pulseEnergy: number;
  maxPulseEnergy: number;
  cubesCollected: number;
  totalCubes: number;
  currentSector: number;
  totalSectors: number;
  checkpointName: string;
  elapsedTime: number; // in seconds
  beatCombo: number;
  maxBeatCombo: number;
  beatAccuracyPct: number;
  score: number;
}

export interface RotatingPlatform {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  rotationSpeed: number; // radians per second
  axis: 'x' | 'y' | 'z';
  currentAngle: number;
  colorHex: number;
}

export interface PulseNetData {
  id: string;
  position: [number, number, number];
  normal: [number, number, number];
  width: number;
  height: number;
  duration: number;
  maxDuration: number;
  colorHex: number;
  ownerId: string;
}

export interface MultiplayerPlayerState {
  id: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  surfaceNormal: [number, number, number];
  speed: number;
  isGrounded: boolean;
  health: number;
  score: number;
  checkpointSector: number;
}

export interface GameSettings {
  mouseSensitivity: number;
  soundVolume: number;
  musicVolume: number;
  muted: boolean;
  invertY: boolean;
  fov: number;
  showScanlines: boolean;
  touchControls: 'auto' | 'on' | 'off';
}

