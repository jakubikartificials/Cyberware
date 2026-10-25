import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MazeBuilder, MazeData } from '../world/MazeBuilder';
import { PlayerController } from '../physics/PlayerController';
import { soundSynth } from '../audio/SoundSynth';
import { GameSettings, PlayerStats, GameState } from '../types';

export class WireScene {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public mazeData!: MazeData;
  public player!: PlayerController;

  private container: HTMLElement;
  private animFrameId: number = 0;
  private isSoftwareGl: boolean = false;
  private clock: THREE.Clock = new THREE.Clock();
  private dustParticles!: THREE.Points;

  // Title screen camera path
  private titleCamAngle: number = 0;

  // Track key states
  public heldKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  // Track analog touch inputs from on-screen joystick
  public touchInputs = {
    analogX: 0,
    analogZ: 0,
  };

  // State refs
  public gameState: GameState = 'title';
  public settings: GameSettings;
  public stats: PlayerStats;

  // Callbacks
  public onStatsUpdate?: (stats: PlayerStats) => void;
  public onStateTransition?: (state: GameState) => void;

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    stats: PlayerStats,
    callbacks: {
      onStatsUpdate?: (stats: PlayerStats) => void;
      onStateTransition?: (state: GameState) => void;
    }
  ) {
    this.container = container;
    this.settings = settings;
    this.stats = stats;
    this.onStatsUpdate = callbacks.onStatsUpdate;
    this.onStateTransition = callbacks.onStateTransition;

    this.initRenderer();
    this.initScene();
    this.initWorld();
    this.initParticles();
    this.initEventListeners();
    this.startLoop();
  }

  private initRenderer(): void {
    // Detect software WebGL as mandated by Three.js skill
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(0x000000, 1);

    this.container.appendChild(this.renderer.domElement);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.016);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.1, 400);

    // Studio Environment reflection
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x112233, 0.6);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(20, 40, 20);
    this.scene.add(keyLight);
  }

  private initWorld(): void {
    const builder = new MazeBuilder();
    this.mazeData = builder.buildWorld();
    this.scene.add(this.mazeData.group);

    this.player = new PlayerController(this.camera);
    this.player.setSpawnPosition([0, 0, 5], 0);

    // Attach event callbacks
    this.player.onCheckpointActivated = (name, sector) => {
      this.stats.checkpointName = name;
      this.stats.currentSector = sector;
      this.onStatsUpdate?.({ ...this.stats });
    };

    this.player.onVictoryReached = () => {
      this.gameState = 'victory';
      this.onStateTransition?.('victory');
    };

    this.player.onCubeCollected = () => {
      this.onStatsUpdate?.({ ...this.stats });
    };

    this.player.onDamageTaken = () => {
      if (this.stats.health <= 0) {
        this.gameState = 'gameover';
        this.onStateTransition?.('gameover');
      } else {
        this.onStatsUpdate?.({ ...this.stats });
      }
    };

    this.player.onBeatComboChanged = (combo) => {
      this.stats.beatCombo = combo;
      this.stats.maxBeatCombo = Math.max(this.stats.maxBeatCombo, combo);
      this.onStatsUpdate?.({ ...this.stats });
    };
  }

  private initParticles(): void {
    // Floating cyber dust specks throughout the labyrinth
    const count = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = -Math.random() * 340;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x88bbff,
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }

  private initEventListeners(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private onResize = (): void => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.code;

    // Global Pause toggle
    if (key === 'Escape') {
      if (this.gameState === 'playing') {
        this.gameState = 'paused';
        document.exitPointerLock?.();
        this.onStateTransition?.('paused');
      } else if (this.gameState === 'paused') {
        this.gameState = 'playing';
        this.onStateTransition?.('playing');
        this.requestPointerLock();
      }
      return;
    }

    // Audio Mute toggle
    if (key === 'KeyM') {
      const isMuted = soundSynth.toggleMute();
      this.settings.muted = isMuted;
      return;
    }

    if (this.gameState !== 'playing') {
      if ((key === 'Space' || key === 'Enter') && this.gameState === 'title') {
        this.startGame();
      } else if ((key === 'Space' || key === 'Enter') && this.gameState === 'gameover') {
        this.respawnPlayer();
      }
      return;
    }

    // Movement keys
    if (key === 'KeyW' || key === 'ArrowUp') this.heldKeys.forward = true;
    if (key === 'KeyS' || key === 'ArrowDown') this.heldKeys.backward = true;
    if (key === 'KeyA' || key === 'ArrowLeft') this.heldKeys.left = true;
    if (key === 'KeyD' || key === 'ArrowRight') this.heldKeys.right = true;

    // Jump
    if (key === 'Space') {
      const nearBeat = soundSynth.getBeatProgress().isNearBeat;
      this.player.queueJump(nearBeat);
    }

    // Dash
    if (key === 'ShiftLeft' || key === 'ShiftRight' || key === 'KeyC') {
      const nearBeat = soundSynth.getBeatProgress().isNearBeat;
      let x = 0;
      let z = 0;
      if (this.heldKeys.forward) z += 1;
      if (this.heldKeys.backward) z -= 1;
      if (this.heldKeys.right) x += 1;
      if (this.heldKeys.left) x -= 1;
      this.player.triggerDash(x, z, nearBeat);
    }

    // Pulse action
    if (key === 'KeyF') {
      this.player.firePulse(this.scene);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.code;
    if (key === 'KeyW' || key === 'ArrowUp') this.heldKeys.forward = false;
    if (key === 'KeyS' || key === 'ArrowDown') this.heldKeys.backward = false;
    if (key === 'KeyA' || key === 'ArrowLeft') this.heldKeys.left = false;
    if (key === 'KeyD' || key === 'ArrowRight') this.heldKeys.right = false;
  };

  private onBlur = (): void => {
    // Clear all held inputs on window blur to avoid stuck movement
    this.heldKeys.forward = false;
    this.heldKeys.backward = false;
    this.heldKeys.left = false;
    this.heldKeys.right = false;
  };

  public handleCanvasClick = (): void => {
    soundSynth.resumeContext();
    if (this.gameState === 'title') {
      this.startGame();
    } else if (this.gameState === 'playing') {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.requestPointerLock();
      } else {
        // Fire pulse weapon/tool on click!
        this.player.firePulse(this.scene);
      }
    }
  };

  public requestPointerLock(): void {
    this.renderer.domElement.requestPointerLock();
  }

  public handleMouseMove = (e: MouseEvent): void => {
    if (this.gameState === 'playing' && document.pointerLockElement === this.renderer.domElement) {
      this.player.handleMouseMove(e.movementX, e.movementY, this.settings);
    }
  };

  public startGame(): void {
    soundSynth.init();
    soundSynth.startMusic();
    this.gameState = 'playing';
    this.stats.elapsedTime = 0;
    this.stats.health = this.stats.maxHealth;
    this.stats.score = 0;
    this.stats.beatCombo = 0;
    this.onStateTransition?.('playing');
    this.requestPointerLock();
  }

  public respawnPlayer(): void {
    this.player.respawnAtLastCheckpoint(this.mazeData, this.stats);
    this.gameState = 'playing';
    this.onStateTransition?.('playing');
    this.requestPointerLock();
  }

  public restartSector(): void {
    const cp = this.mazeData.checkpoints.find(c => c.sectorIndex === this.stats.currentSector);
    if (cp) {
      this.player.setSpawnPosition(cp.position, 0);
    }
    this.stats.health = this.stats.maxHealth;
    this.stats.beatCombo = 0;
    this.gameState = 'playing';
    this.onStateTransition?.('playing');
    this.requestPointerLock();
  }

  public restartGame(): void {
    // Reset all checkpoints except starting one
    this.mazeData.checkpoints.forEach((cp, idx) => {
      cp.activated = idx === 0;
      const mesh = this.mazeData.animatedMeshes.checkpointMeshes.get(cp.id);
      if (mesh) {
        mesh.pointLight.intensity = idx === 0 ? 4 : 1;
        mesh.lightPillar.scale.set(1, 1, 1);
      }
    });

    // Reset cubes
    this.mazeData.chronocubes.forEach(c => {
      c.collected = false;
      const mesh = this.mazeData.animatedMeshes.cubeMeshes.get(c.id);
      if (mesh) mesh.visible = true;
    });

    // Reset stats
    this.stats.elapsedTime = 0;
    this.stats.health = this.stats.maxHealth;
    this.stats.cubesCollected = 0;
    this.stats.score = 0;
    this.stats.beatCombo = 0;
    this.stats.currentSector = 1;
    this.stats.checkpointName = this.mazeData.checkpoints[0].name;

    this.player.setSpawnPosition([0, 0, 5], 0);
    this.gameState = 'playing';
    this.onStateTransition?.('playing');
    this.requestPointerLock();
  }

  private startLoop(): void {
    const tick = () => {
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05); // Clamp frame delta time as mandated

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    const time = this.clock.getElapsedTime();
    const beatInfo = soundSynth.getBeatProgress();

    // 1. Title mode camera pan vs FPS playing mode
    if (this.gameState === 'title') {
      this.titleCamAngle += dt * 0.18;
      // Atmospheric live flythrough around Sector 1 / Pulse Labyrinth
      const camX = Math.sin(this.titleCamAngle) * 16;
      const camZ = -20 + Math.cos(this.titleCamAngle * 0.5) * 45;
      const camY = 4 + Math.sin(this.titleCamAngle * 2) * 1.5;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 3, camZ - 30);
    } else if (this.gameState === 'playing') {
      this.stats.elapsedTime += dt;
      this.stats.score += Math.round(dt * 10 * (1 + this.stats.beatCombo * 0.1));

      this.player.update(
        dt,
        {
          ...this.heldKeys,
          analogX: this.touchInputs.analogX,
          analogZ: this.touchInputs.analogZ,
        },
        this.mazeData,
        this.settings,
        this.stats,
        this.scene
      );

      this.onStatsUpdate?.({ ...this.stats });
    }

    // 2. Animate Shifting Maze Gates
    for (const gate of this.mazeData.shiftingGates) {
      const mesh = this.mazeData.animatedMeshes.gateMeshes.get(gate.id);
      if (!mesh) continue;

      if (gate.isOpen) {
        // Switch-triggered gate: slide open smoothly
        mesh.position.y = THREE.MathUtils.damp(mesh.position.y, gate.position[1] + gate.openOffset, 4, dt);
      } else {
        // Rhythmic cycling gates
        const cycleProgress = (time + gate.phaseOffsetSeconds) % gate.cycleIntervalSeconds;
        const normalized = cycleProgress / gate.cycleIntervalSeconds;
        // Open for ~40% of cycle, closed for ~60%
        const openFactor = Math.sin(normalized * Math.PI * 2);
        const isOpen = openFactor > 0.15;

        const targetOffset = isOpen ? gate.openOffset : 0;

        if (gate.direction === 'up') {
          mesh.position.y = THREE.MathUtils.damp(mesh.position.y, gate.position[1] + targetOffset, 6, dt);
        } else if (gate.direction === 'x') {
          mesh.position.x = THREE.MathUtils.damp(mesh.position.x, gate.position[0] + (isOpen ? gate.openOffset : 0), 6, dt);
        }
      }
    }

    // 3. Animate Phase Platforms (Cyan on odd beats, Magenta on even beats)
    const isOddBeat = Math.floor(beatInfo.beat) % 2 === 1;
    for (const plat of this.mazeData.phasePlatforms) {
      const isActive = plat.phase === 'odd' ? isOddBeat : !isOddBeat;
      plat.active = isActive;

      const platMesh = this.mazeData.animatedMeshes.phasePlatformMeshes.get(plat.id);
      if (platMesh) {
        const targetOpacity = isActive ? 1.0 : 0.12;
        const targetFill = isActive ? 0.9 : 0.05;
        const lineMat = platMesh.lines.material as THREE.LineBasicMaterial;
        const fillMat = platMesh.fill.material as THREE.MeshStandardMaterial;
        lineMat.opacity = THREE.MathUtils.damp(lineMat.opacity, targetOpacity, 14, dt);
        fillMat.opacity = THREE.MathUtils.damp(fillMat.opacity, targetFill, 14, dt);
      }
    }

    // 4. Animate Checkpoints
    for (const cp of this.mazeData.checkpoints) {
      const cpMesh = this.mazeData.animatedMeshes.checkpointMeshes.get(cp.id);
      if (cpMesh) {
        cpMesh.rings.rotation.y += dt * 0.8;
        cpMesh.rings.rotation.x = Math.sin(time * 2) * 0.15;
        // Subtle rhythmic pulse on point light
        const baseInt = cp.activated ? 4 : 1;
        cpMesh.pointLight.intensity = baseInt + Math.sin(beatInfo.phase * Math.PI * 2) * (cp.activated ? 1.5 : 0.4);
      }
    }

    // 5. Animate Jump Pad rings
    for (const pad of this.mazeData.jumpPads) {
      const padMesh = this.mazeData.animatedMeshes.jumpPadMeshes.get(pad.id);
      if (padMesh) {
        // Expand ring with beat phase
        const scale = 0.8 + beatInfo.phase * 0.5;
        padMesh.ring.scale.set(scale, scale, scale);
      }
    }

    // 6. Animate Chronocubes
    for (const cube of this.mazeData.chronocubes) {
      const cubeMesh = this.mazeData.animatedMeshes.cubeMeshes.get(cube.id);
      if (cubeMesh && cubeMesh.visible) {
        cubeMesh.rotation.x += dt * 1.5;
        cubeMesh.rotation.y += dt * 2.2;
        cubeMesh.position.y = cube.position[1] + Math.sin(time * 3 + cube.position[2]) * 0.25;
      }
    }

    // 7. Animate Switches
    for (const sw of this.mazeData.switches) {
      const swMesh = this.mazeData.animatedMeshes.switchMeshes.get(sw.id);
      if (swMesh) {
        swMesh.rotation.y += dt * (sw.activated ? 4 : 1.2);
        swMesh.rotation.z += dt * 0.8;
      }
    }

    // 8. Animate Extraction Core Beacon
    if (this.mazeData.animatedMeshes.coreMesh) {
      const core = this.mazeData.animatedMeshes.coreMesh;
      core.rotation.x += dt * 0.7;
      core.rotation.y += dt * 1.1;
      core.rotation.z += dt * 0.5;
      core.position.y = 7.5 + Math.sin(time * 2) * 0.4;
    }

    // 9. Animate Dust particles
    if (this.dustParticles) {
      const posAttr = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += dt * 0.4;
        if (arr[i + 1] > 20) {
          arr[i + 1] = 0;
        }
      }
      posAttr.needsUpdate = true;
    }
  }

  public dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    soundSynth.stopMusic();

    this.scene.clear();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // Touch action handlers for mobile/tablet controls
  public handleTouchLook(dx: number, dy: number): void {
    if (this.gameState === 'playing') {
      this.player.handleMouseMove(dx, dy, this.settings);
    }
  }

  public handleTouchJump(): void {
    if (this.gameState === 'playing') {
      const nearBeat = soundSynth.getBeatProgress().isNearBeat;
      this.player.queueJump(nearBeat);
    }
  }

  public handleTouchDash(): void {
    if (this.gameState === 'playing') {
      const nearBeat = soundSynth.getBeatProgress().isNearBeat;
      const x = this.touchInputs.analogX;
      const z = -this.touchInputs.analogZ;
      this.player.triggerDash(x, z, nearBeat);
    }
  }

  public handleTouchPulse(): void {
    if (this.gameState === 'playing') {
      this.player.firePulse(this.scene);
    }
  }
}
