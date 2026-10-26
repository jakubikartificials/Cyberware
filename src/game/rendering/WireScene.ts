import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MazeBuilder, MazeData } from '../world/MazeBuilder';
import { PlayerController } from '../physics/PlayerController';
import { soundSynth } from '../audio/SoundSynth';
import { GameSettings, PlayerStats, GameState } from '../types';
import { CrawlerBotsManager } from '../entities/CrawlerBotsManager';
import { PulseNetManager } from '../entities/PulseNetManager';
import { NetworkManager } from '../multiplayer/NetworkManager';

export class WireScene {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public mazeData!: MazeData;
  public player!: PlayerController;
  public crawlerBotsManager!: CrawlerBotsManager;
  public pulseNetManager!: PulseNetManager;
  public networkManager!: NetworkManager;
  public runnerCount: number = 4;

  private container: HTMLElement;
  private animFrameId: number = 0;
  private isSoftwareGl: boolean = false;
  private clock: THREE.Clock = new THREE.Clock();
  private dustParticles!: THREE.Points;

  // Title screen camera path
  private titleCamAngle: number = 0;

  // Dynamic Level Disposition Shift state
  private dispositionTimer: number = 0;
  private isDispositionShifted: boolean = false;

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
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.05, 450);

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
    this.scene.add(this.player.crawler.group);

    // Initialize Pulse Net Manager
    this.pulseNetManager = new PulseNetManager(this.scene);
    this.pulseNetManager.onDispositionShift = () => {
      this.triggerLevelDispositionShift();
      this.networkManager.sendDispositionShift();
    };

    // Initialize Multiplayer Network Manager
    this.networkManager = new NetworkManager(this.scene);
    this.networkManager.onRemoteNetDeployed = (pos, norm) => {
      this.pulseNetManager.deployNet(
        new THREE.Vector3(...pos),
        new THREE.Vector3(...norm),
        'player2',
        0xff007f
      );
      this.triggerLevelDispositionShift();
    };
    this.networkManager.onRemoteDispositionShift = () => {
      this.triggerLevelDispositionShift();
    };
    this.networkManager.onRemotePulseFired = (pos, dir) => {
      // Render remote projectile in scene
      const startPos = new THREE.Vector3(...pos);
      const velocity = new THREE.Vector3(...dir).multiplyScalar(40);
      const geom = new THREE.OctahedronGeometry(0.06, 0);
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: 0xff007f, linewidth: 2 })
      );
      line.position.copy(startPos);
      this.scene.add(line);
      this.player.projectiles.push({
        position: startPos,
        velocity,
        life: 0,
        maxLife: 2.0,
        mesh: line,
      });
    };

    // Forward local pulse net deployments to network
    this.player.onPulseNetDeployed = (pos, normal) => {
      this.networkManager.sendNetDeployed(pos, normal);
    };

    // Initialize Crawler Bots Manager
    this.crawlerBotsManager = new CrawlerBotsManager(this.scene);
    this.crawlerBotsManager.initBots(this.runnerCount);
    this.player.onCheckProjectileHit = (pos) => this.crawlerBotsManager.checkPulseHit(pos, this.stats);

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

  /**
   * Triggers when a crawler lays a pulse net:
   * Level disposition dynamically changes! Shifting gates re-route, rotating platforms speed up/flip,
   * opening alternate passages and changing the labyrinth map layout!
   */
  public triggerLevelDispositionShift(): void {
    this.isDispositionShifted = true;
    this.dispositionTimer = 9.0; // 9 seconds altered map disposition

    // Toggle disposition gates open
    ['gate_disp_1', 'gate_disp_2', 'gate_disp_3', 'gate_secret'].forEach((gateId) => {
      const gate = this.mazeData.shiftingGates.find((g) => g.id === gateId);
      if (gate) {
        gate.isOpen = true;
      }
    });

    // Speed up rotating platforms
    for (const plat of this.mazeData.rotatingPlatforms) {
      plat.rotationSpeed *= -1.5; // Reverse and accelerate rotation
    }

    // Screen shake resonance
    soundSynth.playLevelShift();
  }

  private initParticles(): void {
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
      size: 0.1,
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
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    if (this.gameState === 'playing') {
      // Right click deploys temporary Pulse Net!
      this.deployPulseNet();
    }
  };

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

    // Jump / Wall Leap
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

    // Fire Pulse weapon
    if (key === 'KeyF') {
      this.firePulse();
    }

    // Deploy Temporary Pulse Net ("disable walkthrough net & change level disposition")
    if (key === 'KeyE') {
      this.deployPulseNet();
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
        // Left click fires pulse blaster!
        this.firePulse();
      }
    }
  };

  public firePulse(): void {
    if (this.gameState !== 'playing') return;
    this.player.firePulse(this.scene);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.networkManager.sendPulseFired(this.player.position, dir);
  }

  public deployPulseNet(): void {
    if (this.gameState !== 'playing') return;
    this.player.deployPulseNet(this.pulseNetManager);
  }

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
    this.crawlerBotsManager?.initBots(this.runnerCount);
    this.pulseNetManager?.clear();
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
    const cp = this.mazeData.checkpoints.find((c) => c.sectorIndex === this.stats.currentSector);
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
    this.mazeData.checkpoints.forEach((cp, idx) => {
      cp.activated = idx === 0;
      const mesh = this.mazeData.animatedMeshes.checkpointMeshes.get(cp.id);
      if (mesh) {
        mesh.pointLight.intensity = idx === 0 ? 4 : 1;
        mesh.lightPillar.scale.set(1, 1, 1);
      }
    });

    this.mazeData.chronocubes.forEach((c) => {
      c.collected = false;
      const mesh = this.mazeData.animatedMeshes.cubeMeshes.get(c.id);
      if (mesh) mesh.visible = true;
    });

    this.stats.elapsedTime = 0;
    this.stats.health = this.stats.maxHealth;
    this.stats.cubesCollected = 0;
    this.stats.score = 0;
    this.stats.beatCombo = 0;
    this.stats.currentSector = 1;
    this.stats.checkpointName = this.mazeData.checkpoints[0].name;

    this.player.setSpawnPosition([0, 0, 5], 0);
    this.crawlerBotsManager?.initBots(this.runnerCount);
    this.pulseNetManager?.clear();
    this.gameState = 'playing';
    this.onStateTransition?.('playing');
    this.requestPointerLock();
  }

  public setRunnerCount(count: number): void {
    this.runnerCount = count;
    if (this.crawlerBotsManager) {
      this.crawlerBotsManager.initBots(count);
    }
  }

  private startLoop(): void {
    const tick = () => {
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    const time = this.clock.getElapsedTime();
    const beatInfo = soundSynth.getBeatProgress();

    // 1. Camera mode: Title vs FPS playing mode
    if (this.gameState === 'title') {
      this.titleCamAngle += dt * 0.18;
      const camX = Math.sin(this.titleCamAngle) * 16;
      const camZ = -20 + Math.cos(this.titleCamAngle * 0.5) * 45;
      const camY = 3.5 + Math.sin(this.titleCamAngle * 2) * 1.5;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 2, camZ - 30);
    } else if (this.gameState === 'playing') {
      this.stats.elapsedTime += dt;
      this.stats.score += Math.round(dt * 10 * (1 + this.stats.beatCombo * 0.1));

      // Player update with wall-walking, collision, and pulse nets
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
        this.scene,
        this.pulseNetManager
      );

      // Update bot runners and hazard crawlers
      if (this.crawlerBotsManager) {
        this.crawlerBotsManager.update(
          dt,
          this.player.position,
          this.mazeData,
          this.stats,
          (amount) => {
            this.stats.health = Math.max(0, this.stats.health - amount);
            this.stats.beatCombo = 0;
            if (this.stats.health <= 0) {
              this.gameState = 'gameover';
              this.onStateTransition?.('gameover');
            } else {
              this.onStatsUpdate?.({ ...this.stats });
            }
          },
          this.pulseNetManager
        );
      }

      // Update active pulse nets
      this.pulseNetManager.update(dt, this.mazeData, time);

      // Level Disposition Shift timer
      if (this.isDispositionShifted) {
        this.dispositionTimer -= dt;
        if (this.dispositionTimer <= 0) {
          this.isDispositionShifted = false;
          // Normalize platform speeds back to standard
          for (const plat of this.mazeData.rotatingPlatforms) {
            plat.rotationSpeed = Math.sign(plat.rotationSpeed) * Math.abs(plat.rotationSpeed / 1.5);
          }
        }
      }

      // Broadcast local player state over network
      if (this.networkManager.isConnected) {
        this.networkManager.update(dt, {
          id: 'local',
          position: [this.player.position.x, this.player.position.y, this.player.position.z],
          yaw: this.player.yaw,
          pitch: this.player.pitch,
          surfaceNormal: [this.player.surfaceNormal.x, this.player.surfaceNormal.y, this.player.surfaceNormal.z],
          speed: this.player.velocity.length(),
          isGrounded: this.player.isGrounded || this.player.isWallWalking,
          health: this.stats.health,
          score: this.stats.score,
          checkpointSector: this.stats.currentSector,
        });
      }

      this.onStatsUpdate?.({ ...this.stats });
    }

    // 2. Animate Rotating Platforms
    for (const plat of this.mazeData.rotatingPlatforms) {
      plat.currentAngle += plat.rotationSpeed * dt;
      const meshObj = this.mazeData.animatedMeshes.rotatingPlatformMeshes.get(plat.id);
      if (meshObj) {
        meshObj.group.rotation[plat.axis] = plat.currentAngle;
      }
    }

    // 3. Animate Shifting Maze Gates
    for (const gate of this.mazeData.shiftingGates) {
      const mesh = this.mazeData.animatedMeshes.gateMeshes.get(gate.id);
      if (!mesh) continue;

      if (gate.isOpen) {
        mesh.position.y = THREE.MathUtils.damp(mesh.position.y, gate.position[1] + gate.openOffset, 4, dt);
      } else {
        const cycleProgress = (time + gate.phaseOffsetSeconds) % gate.cycleIntervalSeconds;
        const normalized = cycleProgress / gate.cycleIntervalSeconds;
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

    // 4. Animate Phase Platforms
    const isOddBeat = Math.floor(beatInfo.beat) % 2 === 1;
    for (const plat of this.mazeData.phasePlatforms) {
      const isActive = plat.phase === 'odd' ? isOddBeat : !isOddBeat;
      plat.active = isActive;

      const platMesh = this.mazeData.animatedMeshes.phasePlatformMeshes.get(plat.id);
      if (platMesh) {
        const targetOpacity = isActive ? 1.0 : 0.12;
        const targetFill = isActive ? 0.9 : 0.05;
        (platMesh.lines.material as THREE.LineBasicMaterial).opacity = THREE.MathUtils.damp(
          (platMesh.lines.material as THREE.LineBasicMaterial).opacity,
          targetOpacity,
          16,
          dt
        );
        (platMesh.fill.material as THREE.MeshStandardMaterial).opacity = THREE.MathUtils.damp(
          (platMesh.fill.material as THREE.MeshStandardMaterial).opacity,
          targetFill,
          16,
          dt
        );
      }
    }

    // 5. Animate Jump Pads
    for (const pad of this.mazeData.jumpPads) {
      const padMesh = this.mazeData.animatedMeshes.jumpPadMeshes.get(pad.id);
      if (padMesh) {
        const pulse = 1 + Math.sin(beatInfo.phase * Math.PI * 2) * 0.15;
        padMesh.ring.scale.set(pulse, 1, pulse);
      }
    }

    // 6. Animate Chronocubes
    for (const cube of this.mazeData.chronocubes) {
      if (cube.collected) continue;
      const mesh = this.mazeData.animatedMeshes.cubeMeshes.get(cube.id);
      if (mesh) {
        mesh.rotation.x += dt * 1.5;
        mesh.rotation.y += dt * 2.0;
        mesh.position.y = cube.position[1] + Math.sin(time * 3 + cube.position[2]) * 0.25;
      }
    }

    // 7. Animate Prismatic Core
    if (this.mazeData.animatedMeshes.coreMesh) {
      const core = this.mazeData.animatedMeshes.coreMesh;
      core.rotation.y += dt * 1.2;
      core.rotation.x = Math.sin(time * 0.8) * 0.3;
      core.position.y = 7.5 + Math.sin(time * 2) * 0.5;
    }

    // 8. Animate ambient cyber dust particles
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
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);

    soundSynth.stopMusic();
    this.networkManager.cleanup();
    this.pulseNetManager.clear();

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
    this.firePulse();
  }

  public handleTouchNet(): void {
    this.deployPulseNet();
  }
}
