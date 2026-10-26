import * as THREE from 'three';
import { BoundingBox3D, MazeData } from '../world/MazeBuilder';
import { soundSynth } from '../audio/SoundSynth';
import { GameSettings, PlayerStats } from '../types';
import { CyberCrawler } from '../entities/CyberCrawler';
import { PulseNetManager } from '../entities/PulseNetManager';

export interface PulseProjectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  mesh: THREE.LineSegments;
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0.5, 5);
  public velocity: THREE.Vector3 = new THREE.Vector3();

  // Character Cyber Crawler Avatar & Camera Mode
  public crawler: CyberCrawler = new CyberCrawler(0x00f0ff, true);
  // Third person view is strictly disabled as requested; strictly 1st person cockpit
  public cameraMode: 'first' = 'first';

  // Rotation angles
  public yaw: number = 0;
  public pitch: number = 0;

  // Surface Normal for Wall-Walking (floor: 0,1,0; walls: ±1,0,0 or 0,0,±1; ceiling: 0,-1,0)
  public surfaceNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public targetNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public currentUp: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public isWallWalking: boolean = false;

  // 4x Smaller Player Dimensions
  public height: number = 0.42; // scaled down 4x from 1.7
  public radius: number = 0.12; // scaled down 4x from 0.45

  // Physics params tuned for 4x smaller crawler
  private moveSpeed: number = 8.5;
  private dashSpeed: number = 18.0;
  private gravity: number = 22.0;
  private jumpImpulse: number = 7.0;

  // State flags
  public isGrounded: boolean = false;
  private canDoubleJump: boolean = true;
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;
  private dashTimer: number = 0;
  private isDashing: boolean = false;
  private dashCooldownTimer: number = 0;
  private dashDirection: THREE.Vector3 = new THREE.Vector3();

  // Dynamic Camera effects
  private baseFov: number = 75;
  private currentFov: number = 75;
  private headBobTimer: number = 0;
  private cameraShakeIntensity: number = 0;
  private landSquash: number = 0;

  // Active projectiles & Pulse Net Cooldown
  public projectiles: PulseProjectile[] = [];
  public pulseCooldown: number = 0;
  public pulseNetCooldown: number = 0;
  public maxPulseNetCooldown: number = 3.5;

  // Reusable vectors for zero GC in loop
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();

  // Callbacks for events
  public onCheckpointActivated?: (name: string, sector: number) => void;
  public onVictoryReached?: () => void;
  public onCubeCollected?: (cubeId: string) => void;
  public onDamageTaken?: (amount: number) => void;
  public onBeatComboChanged?: (combo: number) => void;
  public onCheckProjectileHit?: (pos: THREE.Vector3) => boolean;
  public onPulseNetDeployed?: (pos: THREE.Vector3, normal: THREE.Vector3) => void;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.copy(this.position);
    this.camera.up.set(0, 1, 0);

    // Disable visible parts of crawler in cockpit view
    this.crawler.group.visible = false;
  }

  public setSpawnPosition(pos: [number, number, number], yaw: number = 0): void {
    this.position.set(pos[0], pos[1] + this.height, pos[2]);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.surfaceNormal.set(0, 1, 0);
    this.targetNormal.set(0, 1, 0);
    this.currentUp.set(0, 1, 0);
    this.camera.position.copy(this.position);
    this.camera.up.set(0, 1, 0);
  }

  public handleMouseMove(movementX: number, movementY: number, settings: GameSettings): void {
    const sens = settings.mouseSensitivity * 0.0022;
    this.yaw -= movementX * sens;
    const invert = settings.invertY ? -1 : 1;
    this.pitch -= movementY * sens * invert;

    // Clamp pitch between ~-85 and +85 degrees
    const maxPitch = (Math.PI / 2) - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  public queueJump(nearBeat: boolean): void {
    this.jumpBufferTimer = 0.14;

    if (nearBeat) {
      soundSynth.playBeatBonus();
      this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.12);
    }
  }

  public triggerDash(inputX: number, inputZ: number, nearBeat: boolean): boolean {
    if (this.dashCooldownTimer > 0) return false;

    this.computeTangents(this._forward, this._right);

    this.dashDirection.set(0, 0, 0);
    if (inputX !== 0 || inputZ !== 0) {
      this.dashDirection.addScaledVector(this._right, inputX);
      this.dashDirection.addScaledVector(this._forward, -inputZ);
      this.dashDirection.normalize();
    } else {
      this.dashDirection.copy(this._forward);
    }

    this.isDashing = true;
    this.dashTimer = 0.22;
    this.dashCooldownTimer = 1.1;

    // Boost velocity along surface
    this.velocity.copy(this.dashDirection.multiplyScalar(this.dashSpeed));

    soundSynth.playDash();
    this.cameraShakeIntensity = 0.2;

    if (nearBeat) {
      soundSynth.playBeatBonus();
      this.cameraShakeIntensity = 0.28;
    }

    return true;
  }

  /**
   * Fire pulse weapon projectile
   */
  public firePulse(scene: THREE.Scene): void {
    if (this.pulseCooldown > 0) return;
    this.pulseCooldown = 0.32;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const startPos = this.camera.position.clone().addScaledVector(dir, 0.25);

    // 4x smaller projectile
    const geom = new THREE.OctahedronGeometry(0.06, 0);
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 })
    );
    line.position.copy(startPos);
    scene.add(line);

    this.projectiles.push({
      position: startPos,
      velocity: dir.clone().multiplyScalar(40),
      life: 0,
      maxLife: 2.0,
      mesh: line,
    });

    soundSynth.playPulseFire();
  }

  /**
   * Deploy temporary Pulse Net barrier
   */
  public deployPulseNet(pulseNetManager: PulseNetManager): boolean {
    if (this.pulseNetCooldown > 0) return false;
    this.pulseNetCooldown = this.maxPulseNetCooldown;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // Deploy net ahead in gaze direction
    const netPos = this.position.clone().addScaledVector(dir, 1.2);
    netPos.addScaledVector(this.surfaceNormal, 0.4);

    // Net orientation: face away from player or align to corridor
    let netNormal = dir.clone().negate();
    if (Math.abs(netNormal.y) > 0.7) {
      netNormal = new THREE.Vector3(0, Math.sign(netNormal.y), 0);
    } else if (Math.abs(netNormal.x) > Math.abs(netNormal.z)) {
      netNormal = new THREE.Vector3(Math.sign(netNormal.x), 0, 0);
    } else {
      netNormal = new THREE.Vector3(0, 0, Math.sign(netNormal.z));
    }

    pulseNetManager.deployNet(netPos, netNormal, 'player', 0x00f0ff, 4.0, 3.5);
    this.onPulseNetDeployed?.(netPos, netNormal);
    this.cameraShakeIntensity = 0.25;

    return true;
  }

  /**
   * Compute forward and right tangents relative to current surface normal
   */
  private computeTangents(outForward: THREE.Vector3, outRight: THREE.Vector3): void {
    const rawFwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));

    // Project raw forward onto surface plane
    outForward.copy(rawFwd).sub(this.surfaceNormal.clone().multiplyScalar(rawFwd.dot(this.surfaceNormal)));
    if (outForward.lengthSq() < 0.001) {
      // Degenerate: pick arbitrary orthogonal vector
      const alt = Math.abs(this.surfaceNormal.y) > 0.8 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
      outForward.crossVectors(this.surfaceNormal, alt);
    }
    outForward.normalize();

    // Right vector is forward cross normal
    outRight.crossVectors(outForward, this.surfaceNormal).normalize();
  }

  public update(
    dt: number,
    heldInputs: { forward: boolean; backward: boolean; left: boolean; right: boolean; analogX?: number; analogZ?: number },
    mazeData: MazeData,
    settings: GameSettings,
    stats: PlayerStats,
    scene: THREE.Scene,
    pulseNetManager?: PulseNetManager
  ): void {
    // 1. Process cooldown timers
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
    if (this.pulseNetCooldown > 0) this.pulseNetCooldown -= dt;
    if (this.cameraShakeIntensity > 0) this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 3);
    if (this.landSquash > 0) this.landSquash = Math.max(0, this.landSquash - dt * 4);

    const beatInfo = soundSynth.getBeatProgress();

    // 2. Dash state
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // 3. Wall Walking Surface Alignment & Cling Detection
    const wallCheckDist = this.radius + 0.16;
    let detectedNormal: THREE.Vector3 | null = null;

    // Check contact with colliders in 6 orthogonal cardinal directions
    const checkDirections = [
      new THREE.Vector3(0, -1, 0),  // Floor
      new THREE.Vector3(-1, 0, 0),  // Left Wall
      new THREE.Vector3(1, 0, 0),   // Right Wall
      new THREE.Vector3(0, 0, -1),  // Forward Wall
      new THREE.Vector3(0, 0, 1),   // Back Wall
      new THREE.Vector3(0, 1, 0),   // Ceiling
    ];

    for (const dir of checkDirections) {
      const probeX = this.position.x + dir.x * wallCheckDist;
      const probeY = this.position.y + dir.y * wallCheckDist;
      const probeZ = this.position.z + dir.z * wallCheckDist;

      if (this.checkCollisionAt(probeX, probeY, probeZ, mazeData, pulseNetManager)) {
        // Normal points outwards from wall into room
        detectedNormal = dir.clone().negate();
        break;
      }
    }

    // If contact detected, magnetize crawler to that surface
    if (detectedNormal) {
      if (detectedNormal.distanceTo(this.targetNormal) > 0.3) {
        soundSynth.playWallMagnetize();
        this.cameraShakeIntensity = 0.15;
      }
      this.targetNormal.copy(detectedNormal);
      this.isWallWalking = Math.abs(this.targetNormal.y - 1) > 0.05;
    } else {
      // In mid-air with no walls near: gradually return gravity to floor
      if (!this.isGrounded && this.position.y > 0) {
        this.targetNormal.lerp(new THREE.Vector3(0, 1, 0), dt * 3);
      }
    }

    // Smoothly interpolate active surface normal
    this.surfaceNormal.lerp(this.targetNormal, dt * 10).normalize();
    this.currentUp.lerp(this.surfaceNormal, dt * 10).normalize();

    // 4. Directional inputs
    this.computeTangents(this._forward, this._right);
    this._moveDir.set(0, 0, 0);

    const hasAnalog = heldInputs.analogX !== undefined && heldInputs.analogZ !== undefined &&
      (Math.abs(heldInputs.analogX) > 0.05 || Math.abs(heldInputs.analogZ) > 0.05);

    if (hasAnalog) {
      this._moveDir.addScaledVector(this._right, heldInputs.analogX!);
      this._moveDir.addScaledVector(this._forward, -heldInputs.analogZ!);
    } else {
      if (heldInputs.forward) this._moveDir.add(this._forward);
      if (heldInputs.backward) this._moveDir.sub(this._forward);
      if (heldInputs.right) this._moveDir.add(this._right);
      if (heldInputs.left) this._moveDir.sub(this._right);
    }

    const isMoving = this._moveDir.lengthSq() > 0.001;
    if (isMoving) this._moveDir.normalize();

    // 5. Jump logic along active surface normal
    if (this.jumpBufferTimer > 0) {
      if (this.isGrounded || this.coyoteTimer > 0 || this.isWallWalking) {
        // Leap directly away from wall / floor surface
        this.velocity.copy(this.surfaceNormal.clone().multiplyScalar(this.jumpImpulse));
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.canDoubleJump = true;
        soundSynth.playJump();

        if (beatInfo.isNearBeat) {
          stats.beatCombo++;
          stats.maxBeatCombo = Math.max(stats.maxBeatCombo, stats.beatCombo);
          this.onBeatComboChanged?.(stats.beatCombo);
        }
      } else if (this.canDoubleJump) {
        this.velocity.copy(this.surfaceNormal.clone().multiplyScalar(this.jumpImpulse * 0.9));
        this.canDoubleJump = false;
        this.jumpBufferTimer = 0;
        soundSynth.playDoubleJump();
      }
    }

    // 6. Acceleration and Friction
    if (!this.isDashing) {
      const targetSpeed = this.moveSpeed * (1 + Math.min(0.5, stats.beatCombo * 0.08));
      const accel = this.isGrounded || this.isWallWalking ? 38 : 14;
      const friction = this.isGrounded || this.isWallWalking ? 22 : 2.5;

      if (isMoving) {
        this.velocity.addScaledVector(this._moveDir, accel * dt);
        // Clamp speed along surface plane
        const currentSpd = this.velocity.length();
        if (currentSpd > targetSpeed) {
          this.velocity.multiplyScalar(targetSpeed / currentSpd);
        }

        if (this.isGrounded || this.isWallWalking) {
          this.headBobTimer += dt * 14;
          if (this.headBobTimer >= Math.PI) {
            this.headBobTimer -= Math.PI;
            soundSynth.playFootstep();
          }
        }
      } else {
        const speed = this.velocity.length();
        if (speed > 0.01) {
          const drop = friction * dt;
          const newSpd = Math.max(0, speed - drop);
          this.velocity.multiplyScalar(newSpd / speed);
        } else {
          this.velocity.set(0, 0, 0);
        }
      }
    }

    // 7. Gravity acting toward opposite of surface normal
    this.velocity.addScaledVector(this.surfaceNormal, -this.gravity * dt);

    // 8. Kinematic collision handling
    const wasGrounded = this.isGrounded;
    this.isGrounded = false;

    // Movement X
    const newX = this.position.x + this.velocity.x * dt;
    if (!this.checkCollisionAt(newX, this.position.y, this.position.z, mazeData, pulseNetManager)) {
      this.position.x = newX;
    } else {
      this.velocity.x = 0;
    }

    // Movement Z
    const newZ = this.position.z + this.velocity.z * dt;
    if (!this.checkCollisionAt(this.position.x, this.position.y, newZ, mazeData, pulseNetManager)) {
      this.position.z = newZ;
    } else {
      this.velocity.z = 0;
    }

    // Movement Y
    const newY = this.position.y + this.velocity.y * dt;
    const floorY = this.getHighestFloorUnder(this.position.x, newY, this.position.z, mazeData);

    if (floorY !== null && newY - this.height <= floorY && this.velocity.y <= 0) {
      this.position.y = floorY + this.height;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.15;
      this.canDoubleJump = true;
      if (!wasGrounded) this.landSquash = 0.05;
    } else {
      const ceilingY = this.getLowestCeilingAbove(this.position.x, newY, this.position.z, mazeData);
      if (ceilingY !== null && newY >= ceilingY && this.velocity.y > 0) {
        this.position.y = ceilingY - 0.05;
        this.velocity.y = 0;
      } else {
        if (!this.checkCollisionAt(this.position.x, newY, this.position.z, mazeData, pulseNetManager)) {
          this.position.y = newY;
        } else {
          this.velocity.y = 0;
        }
      }
    }

    // 9. Void Fall Reset
    if (this.position.y < -15) {
      this.respawnAtLastCheckpoint(mazeData, stats);
    }

    // 10. Check Jump Pads
    for (const pad of mazeData.jumpPads) {
      const dx = this.position.x - pad.position[0];
      const dy = (this.position.y - this.height) - pad.position[1];
      const dz = this.position.z - pad.position[2];
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      if (distXZ <= pad.size[0] / 2 && Math.abs(dy) <= 0.6) {
        this.velocity.copy(this.surfaceNormal.clone().multiplyScalar(pad.power));
        this.isGrounded = false;
        soundSynth.playJumpPad();
        this.cameraShakeIntensity = 0.35;
        break;
      }
    }

    // 11. Check Checkpoints
    for (const cp of mazeData.checkpoints) {
      const dx = this.position.x - cp.position[0];
      const dy = (this.position.y - this.height) - cp.position[1];
      const dz = this.position.z - cp.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= cp.radius) {
        if (!cp.activated) {
          cp.activated = true;
          soundSynth.playCheckpoint();
          soundSynth.sectorIntensity = Math.min(4, cp.sectorIndex);
          stats.currentSector = cp.sectorIndex;
          stats.checkpointName = cp.name;

          const meshData = mazeData.animatedMeshes.checkpointMeshes.get(cp.id);
          if (meshData) {
            meshData.pointLight.intensity = 5;
            meshData.lightPillar.scale.set(1.4, 1, 1.4);
          }

          this.onCheckpointActivated?.(cp.name, cp.sectorIndex);

          if (cp.id === 'cp_victory') {
            this.onVictoryReached?.();
          }
        }
      }
    }

    // 12. Chronocubes collection
    for (const cube of mazeData.chronocubes) {
      if (cube.collected) continue;
      const dist = this.position.distanceTo(new THREE.Vector3(...cube.position));
      if (dist <= 1.0) {
        cube.collected = true;
        stats.cubesCollected++;
        stats.score += 500 * (1 + stats.beatCombo * 0.2);
        soundSynth.playCubeCollect();
        const mesh = mazeData.animatedMeshes.cubeMeshes.get(cube.id);
        if (mesh) mesh.visible = false;
        this.onCubeCollected?.(cube.id);
      }
    }

    // 13. Lasers check
    const currentBeatMod4 = Math.floor(beatInfo.beat) % 4;
    for (const laser of mazeData.lasers) {
      if (!laser.activeBeats.includes(currentBeatMod4)) continue;
      const p1 = new THREE.Vector3(...laser.start);
      const p2 = new THREE.Vector3(...laser.end);
      const seg = p2.clone().sub(p1);
      const segLen = seg.length();
      const segDir = seg.clone().normalize();

      const toPlayer = this.position.clone().sub(p1);
      const proj = toPlayer.dot(segDir);

      if (proj >= 0 && proj <= segLen) {
        const closestPt = p1.clone().addScaledVector(segDir, proj);
        if (this.position.distanceTo(closestPt) <= 0.4) {
          stats.health = Math.max(0, stats.health - laser.damage * dt * 4);
          this.cameraShakeIntensity = 0.4;
          soundSynth.playHazardHit();
          stats.beatCombo = 0;
          this.onDamageTaken?.(laser.damage * dt);
        }
      }
    }

    // 14. Projectiles update
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life += dt;
      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.position.copy(proj.position);

      let hit = this.checkCollisionAt(proj.position.x, proj.position.y, proj.position.z, mazeData, pulseNetManager);

      // Check switch targets
      for (const sw of mazeData.switches) {
        const swPos = new THREE.Vector3(...sw.position);
        if (proj.position.distanceTo(swPos) <= sw.radius) {
          hit = true;
          sw.activated = !sw.activated;
          soundSynth.playSwitchHit();
          if (sw.linkedGateId) {
            const gate = mazeData.shiftingGates.find(g => g.id === sw.linkedGateId);
            if (gate) {
              gate.isOpen = true;
              soundSynth.playGateShift();
            }
          }
          break;
        }
      }

      // Check hit with hazard crawler bots
      if (!hit && this.onCheckProjectileHit && this.onCheckProjectileHit(proj.position)) {
        hit = true;
      }

      if (hit || proj.life >= proj.maxLife) {
        scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 15. Camera transform in pure Cockpit View (zero crawler visible)
    this.baseFov = settings.fov;
    const targetFov = this.isDashing ? this.baseFov + 14 : this.baseFov;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 12, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Align camera UP vector with current surface normal (enabling seamless wall walking!)
    this.camera.up.copy(this.currentUp);

    const bobOffset = Math.sin(this.headBobTimer * 2) * (isMoving && (this.isGrounded || this.isWallWalking) ? 0.02 : 0);
    const shakeX = (Math.random() * 2 - 1) * this.cameraShakeIntensity * 0.08;
    const shakeY = (Math.random() * 2 - 1) * this.cameraShakeIntensity * 0.08;

    // Eye position in cockpit
    const eyePos = this.position.clone();
    eyePos.addScaledVector(this.surfaceNormal, bobOffset - this.landSquash);
    eyePos.x += shakeX;
    eyePos.y += shakeY;

    this.camera.position.copy(eyePos);

    // Compute look-at point from yaw and pitch aligned with surface normal
    this.computeTangents(this._forward, this._right);
    const lookDir = this._forward.clone().multiplyScalar(Math.cos(this.pitch));
    lookDir.addScaledVector(this.surfaceNormal, Math.sin(this.pitch));
    lookDir.normalize();

    this.camera.lookAt(eyePos.clone().add(lookDir));

    // Hide player's own crawler mesh completely in cockpit view
    this.crawler.group.visible = false;

    // Update crawler transform for other players/reflection
    const horizSpeed = this.velocity.length();
    this.crawler.setPositionAndRotation(this.position, this.yaw, this.surfaceNormal);
    this.crawler.update(dt, horizSpeed, this.isGrounded || this.isWallWalking);

    // Dynamic stats update
    stats.dashCharge = Math.min(stats.maxDashCharge, stats.maxDashCharge * (1 - Math.max(0, this.dashCooldownTimer) / 1.1));
  }

  /**
   * Collision check at specific point against maze colliders, shifting gates, and pulse nets
   */
  public checkCollisionAt(x: number, y: number, z: number, mazeData: MazeData, pulseNetManager?: PulseNetManager): boolean {
    const minX = x - this.radius;
    const maxX = x + this.radius;
    const minY = y - this.height;
    const maxY = y + this.height * 0.2;
    const minZ = z - this.radius;
    const maxZ = z + this.radius;

    // Static maze walls
    for (const box of mazeData.colliders) {
      if (box.maxY <= minY || box.minY >= maxY) continue;
      if (maxX > box.minX && minX < box.maxX && maxZ > box.minZ && minZ < box.maxZ) {
        return true;
      }
    }

    // Dynamic shifting gates
    for (const gate of mazeData.shiftingGates) {
      const mesh = mazeData.animatedMeshes.gateMeshes.get(gate.id);
      if (!mesh) continue;
      const gx = mesh.position.x;
      const gy = mesh.position.y;
      const gz = mesh.position.z;
      const hw = gate.size[0] / 2;
      const hh = gate.size[1] / 2;
      const hd = gate.size[2] / 2;

      if (
        maxX > gx - hw && minX < gx + hw &&
        maxY > gy - hh && minY < gy + hh &&
        maxZ > gz - hd && minZ < gz + hd
      ) {
        return true;
      }
    }

    // Pulse Net barriers ("disable walkthrough net")
    if (pulseNetManager && pulseNetManager.checkNetCollision(x, y, z, this.radius)) {
      return true;
    }

    return false;
  }

  private getHighestFloorUnder(x: number, y: number, z: number, mazeData: MazeData): number | null {
    let highest: number | null = null;
    const feetY = y - this.height;

    for (const box of mazeData.colliders) {
      if (x >= box.minX - this.radius && x <= box.maxX + this.radius &&
          z >= box.minZ - this.radius && z <= box.maxZ + this.radius) {
        if (box.maxY <= feetY + 0.15 && (highest === null || box.maxY > highest)) {
          highest = box.maxY;
        }
      }
    }

    for (const plat of mazeData.phasePlatforms) {
      if (!plat.active) continue;
      const hw = plat.size[0] / 2;
      const hd = plat.size[2] / 2;
      const topY = plat.position[1];

      if (
        x >= plat.position[0] - hw - this.radius && x <= plat.position[0] + hw + this.radius &&
        z >= plat.position[2] - hd - this.radius && z <= plat.position[2] + hd + this.radius
      ) {
        if (topY <= feetY + 0.15 && (highest === null || topY > highest)) {
          highest = topY;
        }
      }
    }

    return highest;
  }

  private getLowestCeilingAbove(x: number, y: number, z: number, mazeData: MazeData): number | null {
    let lowest: number | null = null;
    for (const box of mazeData.colliders) {
      if (x >= box.minX - this.radius && x <= box.maxX + this.radius &&
          z >= box.minZ - this.radius && z <= box.maxZ + this.radius) {
        if (box.minY >= y && (lowest === null || box.minY < lowest)) {
          lowest = box.minY;
        }
      }
    }
    return lowest;
  }

  public respawnAtLastCheckpoint(mazeData: MazeData, stats: PlayerStats): void {
    let activeCp = mazeData.checkpoints.filter(cp => cp.activated).pop();
    if (!activeCp) activeCp = mazeData.checkpoints[0];

    this.setSpawnPosition(activeCp.position, 0);
    this.velocity.set(0, 0, 0);
    stats.health = stats.maxHealth;
    stats.beatCombo = 0;
    this.cameraShakeIntensity = 0.5;
    soundSynth.playHazardHit();
  }
}
