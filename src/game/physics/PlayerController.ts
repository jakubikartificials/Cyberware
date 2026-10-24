import * as THREE from 'three';
import { BoundingBox3D, MazeData } from '../world/MazeBuilder';
import { soundSynth } from '../audio/SoundSynth';
import { GameSettings, PlayerStats } from '../types';

export interface PulseProjectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  mesh: THREE.LineSegments;
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3 = new THREE.Vector3(0, 2, 5);
  public velocity: THREE.Vector3 = new THREE.Vector3();

  // Rotation angles
  public yaw: number = 0;
  public pitch: number = 0;

  // Player dimensions
  public height: number = 1.7;
  public radius: number = 0.45;

  // Physics params
  private moveSpeed: number = 11;
  private dashSpeed: number = 24;
  private gravity: number = 32;
  private jumpImpulse: number = 11.5;

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

  // Active projectiles
  public projectiles: PulseProjectile[] = [];
  private pulseCooldown: number = 0;

  // Reusable vectors for zero GC in loop
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _moveDir = new THREE.Vector3();
  private readonly _tempBox: BoundingBox3D = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

  // Callbacks for events
  public onCheckpointActivated?: (name: string, sector: number) => void;
  public onVictoryReached?: () => void;
  public onCubeCollected?: (cubeId: string) => void;
  public onDamageTaken?: (amount: number) => void;
  public onBeatComboChanged?: (combo: number) => void;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
  }

  public setSpawnPosition(pos: [number, number, number], yaw: number = 0): void {
    this.position.set(pos[0], pos[1] + this.height, pos[2]);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.camera.position.copy(this.position);
    this.camera.rotation.set(0, yaw, 0);
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

    // Calculate dash vector from input or forward
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

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

    // Boost forward velocity
    this.velocity.x = this.dashDirection.x * this.dashSpeed;
    this.velocity.z = this.dashDirection.z * this.dashSpeed;
    this.velocity.y = Math.max(this.velocity.y, 2.5);

    soundSynth.playDash();
    this.cameraShakeIntensity = 0.2;

    if (nearBeat) {
      soundSynth.playBeatBonus();
      this.cameraShakeIntensity = 0.28;
    }

    return true;
  }

  public firePulse(scene: THREE.Scene): void {
    if (this.pulseCooldown > 0) return;
    this.pulseCooldown = 0.35;

    // Direction vector from camera orientation
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const startPos = this.camera.position.clone().addScaledVector(dir, 0.6);

    // Create wireframe diamond/pulsar projectile
    const geom = new THREE.OctahedronGeometry(0.2, 0);
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 })
    );
    line.position.copy(startPos);
    scene.add(line);

    this.projectiles.push({
      position: startPos,
      velocity: dir.clone().multiplyScalar(45),
      life: 0,
      maxLife: 1.8,
      mesh: line,
    });

    soundSynth.playPulseFire();
  }

  public update(
    dt: number,
    heldInputs: { forward: boolean; backward: boolean; left: boolean; right: boolean },
    mazeData: MazeData,
    settings: GameSettings,
    stats: PlayerStats,
    scene: THREE.Scene
  ): void {
    // 1. Process timers
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
    if (this.cameraShakeIntensity > 0) this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 3);
    if (this.landSquash > 0) this.landSquash = Math.max(0, this.landSquash - dt * 4);

    const beatInfo = soundSynth.getBeatProgress();

    // 2. Dash state management
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    // 3. Jump logic
    if (this.jumpBufferTimer > 0) {
      if (this.isGrounded || this.coyoteTimer > 0) {
        // Normal jump
        this.velocity.y = this.jumpImpulse;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.canDoubleJump = true;
        soundSynth.playJump();

        if (beatInfo.isNearBeat) {
          stats.beatCombo++;
          stats.maxBeatCombo = Math.max(stats.maxBeatCombo, stats.beatCombo);
          this.onBeatComboChanged?.(stats.beatCombo);
        } else {
          stats.beatCombo = Math.max(0, stats.beatCombo - 1);
        }
      } else if (this.canDoubleJump) {
        // Double jump
        this.velocity.y = this.jumpImpulse * 0.95;
        this.canDoubleJump = false;
        this.jumpBufferTimer = 0;
        soundSynth.playDoubleJump();

        if (beatInfo.isNearBeat) {
          stats.beatCombo++;
          stats.maxBeatCombo = Math.max(stats.maxBeatCombo, stats.beatCombo);
          this.onBeatComboChanged?.(stats.beatCombo);
        }
      }
    }

    // 4. Directional movement input
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    this._moveDir.set(0, 0, 0);
    if (heldInputs.forward) this._moveDir.add(this._forward);
    if (heldInputs.backward) this._moveDir.sub(this._forward);
    if (heldInputs.right) this._moveDir.add(this._right);
    if (heldInputs.left) this._moveDir.sub(this._right);

    const isMoving = this._moveDir.lengthSq() > 0.001;
    if (isMoving) {
      this._moveDir.normalize();
    }

    // 5. Apply horizontal acceleration & friction
    if (!this.isDashing) {
      const targetSpeed = this.moveSpeed * (1 + Math.min(0.5, stats.beatCombo * 0.08));
      const accel = this.isGrounded ? 45 : 18;
      const friction = this.isGrounded ? 28 : 3;

      if (isMoving) {
        this.velocity.x += this._moveDir.x * accel * dt;
        this.velocity.z += this._moveDir.z * accel * dt;

        // Clamp horizontal velocity
        const horizSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (horizSpeed > targetSpeed) {
          const factor = targetSpeed / horizSpeed;
          this.velocity.x *= factor;
          this.velocity.z *= factor;
        }

        // Footstep sounds
        if (this.isGrounded) {
          this.headBobTimer += dt * 14;
          if (this.headBobTimer >= Math.PI) {
            this.headBobTimer -= Math.PI;
            soundSynth.playFootstep();
          }
        }
      } else {
        // Decelerate
        const hSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (hSpeed > 0.01) {
          const drop = friction * dt;
          const newSpeed = Math.max(0, hSpeed - drop);
          this.velocity.x = (this.velocity.x / hSpeed) * newSpeed;
          this.velocity.z = (this.velocity.z / hSpeed) * newSpeed;
        } else {
          this.velocity.x = 0;
          this.velocity.z = 0;
        }
      }
    }

    // 6. Apply gravity
    this.velocity.y -= this.gravity * dt;
    // Terminal fall speed
    this.velocity.y = Math.max(this.velocity.y, -45);

    // 7. Kinematic collision handling (Separate X, Z, and Y axes for smooth wall sliding)
    const wasGrounded = this.isGrounded;
    this.isGrounded = false;

    // Movement X
    const newX = this.position.x + this.velocity.x * dt;
    if (!this.checkWallCollision(newX, this.position.y, this.position.z, mazeData)) {
      this.position.x = newX;
    } else {
      this.velocity.x = 0;
    }

    // Movement Z
    const newZ = this.position.z + this.velocity.z * dt;
    if (!this.checkWallCollision(this.position.x, this.position.y, newZ, mazeData)) {
      this.position.z = newZ;
    } else {
      this.velocity.z = 0;
    }

    // Movement Y (Vertical & Ground collision)
    const newY = this.position.y + this.velocity.y * dt;
    const floorY = this.getHighestFloorUnder(this.position.x, newY, this.position.z, mazeData);

    if (floorY !== null && newY - this.height <= floorY && this.velocity.y <= 0) {
      // Land on floor
      this.position.y = floorY + this.height;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.15;
      this.canDoubleJump = true;

      if (!wasGrounded) {
        this.landSquash = 0.08;
      }
    } else {
      // Check ceiling collision
      const ceilingY = this.getLowestCeilingAbove(this.position.x, newY, this.position.z, mazeData);
      if (ceilingY !== null && newY >= ceilingY && this.velocity.y > 0) {
        this.position.y = ceilingY - 0.05;
        this.velocity.y = 0;
      } else {
        this.position.y = newY;
      }
    }

    // 8. Void Fall Reset (Respawn at last checkpoint if fallen below abyss)
    if (this.position.y < -12) {
      this.respawnAtLastCheckpoint(mazeData, stats);
    }

    // 9. Interactive Elements Check: Jump Pads
    for (const pad of mazeData.jumpPads) {
      const dx = this.position.x - pad.position[0];
      const dy = (this.position.y - this.height) - pad.position[1];
      const dz = this.position.z - pad.position[2];
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      if (distXZ <= pad.size[0] / 2 && Math.abs(dy) <= 0.6) {
        // Trigger Jump Pad!
        this.velocity.y = pad.power;
        this.isGrounded = false;
        soundSynth.playJumpPad();
        this.cameraShakeIntensity = 0.35;

        // Reward beat timing
        if (beatInfo.isNearBeat) {
          stats.beatCombo += 2;
          this.velocity.y *= 1.15;
          soundSynth.playBeatBonus();
          this.onBeatComboChanged?.(stats.beatCombo);
        }
        break;
      }
    }

    // 10. Interactive Elements Check: Checkpoints
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

          // Increase point light brightness
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

    // 11. Interactive Elements Check: Chronocubes
    for (const cube of mazeData.chronocubes) {
      if (cube.collected) continue;
      const dx = this.position.x - cube.position[0];
      const dy = this.position.y - cube.position[1];
      const dz = this.position.z - cube.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= 1.5) {
        cube.collected = true;
        stats.cubesCollected++;
        stats.score += 500 * (1 + stats.beatCombo * 0.2);
        soundSynth.playCubeCollect();

        // Hide mesh
        const mesh = mazeData.animatedMeshes.cubeMeshes.get(cube.id);
        if (mesh) mesh.visible = false;

        this.onCubeCollected?.(cube.id);
      }
    }

    // 12. Interactive Elements Check: Laser Hazards
    const currentBeatMod4 = Math.floor(beatInfo.beat) % 4;
    for (const laser of mazeData.lasers) {
      if (!laser.activeBeats.includes(currentBeatMod4)) continue;

      // Check distance from player to laser line segment
      const p1 = new THREE.Vector3(...laser.start);
      const p2 = new THREE.Vector3(...laser.end);
      const seg = p2.clone().sub(p1);
      const segLen = seg.length();
      const segDir = seg.clone().normalize();

      const playerPos = this.position.clone();
      playerPos.y -= this.height * 0.5;

      const toPlayer = playerPos.clone().sub(p1);
      const proj = toPlayer.dot(segDir);

      if (proj >= 0 && proj <= segLen) {
        const closestPt = p1.clone().addScaledVector(segDir, proj);
        const dist = playerPos.distanceTo(closestPt);

        if (dist <= 0.8) {
          // Take damage & knockback
          stats.health = Math.max(0, stats.health - laser.damage * dt * 4);
          this.cameraShakeIntensity = 0.4;
          soundSynth.playHazardHit();
          stats.beatCombo = 0;
          this.onDamageTaken?.(laser.damage * dt * 4);
        }
      }
    }

    // 13. Update Pulse Projectiles & Check Switch Hits
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life += dt;
      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.position.copy(proj.position);
      proj.mesh.rotation.x += dt * 10;
      proj.mesh.rotation.y += dt * 10;

      let hit = false;

      // Check hit with wall colliders
      for (const col of mazeData.colliders) {
        if (
          proj.position.x >= col.minX && proj.position.x <= col.maxX &&
          proj.position.y >= col.minY && proj.position.y <= col.maxY &&
          proj.position.z >= col.minZ && proj.position.z <= col.maxZ
        ) {
          hit = true;
          break;
        }
      }

      // Check hit with switches
      for (const sw of mazeData.switches) {
        const dist = proj.position.distanceTo(new THREE.Vector3(...sw.position));
        if (dist <= sw.radius && !sw.activated) {
          sw.activated = true;
          hit = true;
          soundSynth.playPulseHit();

          // Open linked gate if any
          if (sw.linkedGateId) {
            const gate = mazeData.shiftingGates.find(g => g.id === sw.linkedGateId);
            if (gate) {
              gate.isOpen = true;
              soundSynth.playGateShift();
            }
          }

          const mesh = mazeData.animatedMeshes.switchMeshes.get(sw.id);
          if (mesh) {
            mesh.scale.set(1.5, 1.5, 1.5);
          }
          break;
        }
      }

      if (hit || proj.life >= proj.maxLife) {
        scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 14. Camera transform update
    this.baseFov = settings.fov;
    const targetFov = this.isDashing ? this.baseFov + 14 : this.baseFov;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 12, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Camera positioning with head bob & shake
    const bobOffset = Math.sin(this.headBobTimer * 2) * (isMoving && this.isGrounded ? 0.05 : 0);
    const shakeX = (Math.random() * 2 - 1) * this.cameraShakeIntensity * 0.15;
    const shakeY = (Math.random() * 2 - 1) * this.cameraShakeIntensity * 0.15;

    this.camera.position.set(
      this.position.x + shakeX,
      this.position.y - this.landSquash + bobOffset + shakeY,
      this.position.z
    );

    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // Dynamic stats update
    stats.dashCharge = Math.min(stats.maxDashCharge, stats.maxDashCharge * (1 - Math.max(0, this.dashCooldownTimer) / 1.1));
  }

  // Check collision with static and dynamic colliders
  private checkWallCollision(x: number, y: number, z: number, mazeData: MazeData): boolean {
    const minX = x - this.radius;
    const maxX = x + this.radius;
    const minY = y - this.height + 0.2;
    const maxY = y - 0.1;
    const minZ = z - this.radius;
    const maxZ = z + this.radius;

    // Check static colliders
    for (const box of mazeData.colliders) {
      if (box.maxY <= minY || box.minY >= maxY) continue;
      if (maxX > box.minX && minX < box.maxX && maxZ > box.minZ && minZ < box.maxZ) {
        return true;
      }
    }

    // Check dynamic shifting gates (when closed or partly closed)
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

    return false;
  }

  private getHighestFloorUnder(x: number, y: number, z: number, mazeData: MazeData): number | null {
    let highest: number | null = null;
    const feetY = y - this.height;

    // Static floors
    for (const box of mazeData.colliders) {
      if (x >= box.minX - this.radius && x <= box.maxX + this.radius &&
          z >= box.minZ - this.radius && z <= box.maxZ + this.radius) {
        if (box.maxY <= feetY + 0.35 && (highest === null || box.maxY > highest)) {
          highest = box.maxY;
        }
      }
    }

    // Phase platforms (only solid if currently active!)
    for (const plat of mazeData.phasePlatforms) {
      if (!plat.active) continue;
      const hw = plat.size[0] / 2;
      const hd = plat.size[2] / 2;
      const topY = plat.position[1];

      if (
        x >= plat.position[0] - hw - this.radius && x <= plat.position[0] + hw + this.radius &&
        z >= plat.position[2] - hd - this.radius && z <= plat.position[2] + hd + this.radius
      ) {
        if (topY <= feetY + 0.35 && (highest === null || topY > highest)) {
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
