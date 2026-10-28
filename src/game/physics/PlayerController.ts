import * as THREE from 'three';
import { BoundingBox3D, MazeData } from '../world/MazeBuilder';
import { soundSynth } from '../audio/SoundSynth';
import { GameSettings, PlayerStats } from '../types';
import { CyberCrawler } from '../entities/CyberCrawler';

export interface PulseProjectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  mesh: THREE.LineSegments;
}

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public position: THREE.Vector3 = new THREE.Vector3(0, 1.75, 5);
  public velocity: THREE.Vector3 = new THREE.Vector3();

  // Character Cyber Sentinel Avatar (visible to other players/reflections, hidden in cockpit)
  public crawler: CyberCrawler = new CyberCrawler(0x00f0ff, true);
  public cameraMode: 'first' = 'first';

  // Rotation angles
  public yaw: number = 0;
  public pitch: number = 0;

  // Camera orientation & Gravity Mode
  // 1.0 = Normal gravity (floor below, y down)
  // -1.0 = Upside-down inverted gravity (ceiling above, y up)
  public gravityMultiplier: number = 1.0;
  public cameraRoll: number = 0; // target roll: 0 for normal, Math.PI for upside down
  public currentRoll: number = 0;

  // Player Dimensions (4x bigger)
  public height: number = 1.68;
  public radius: number = 0.48;

  // Physics parameters
  private moveSpeed: number = 10.5;
  private gravity: number = 22.0;
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

  // Active pulse projectiles
  public projectiles: PulseProjectile[] = [];
  public pulseCooldown: number = 0;

  // Climbing Rope / Grappling Tether System
  public isRopeAttached: boolean = false;
  public isPullingRope: boolean = false;
  public ropeAnchor: THREE.Vector3 = new THREE.Vector3();
  public ropeCooldown: number = 0;
  private ropeLineMesh: THREE.Line | null = null;
  private ropeAnchorMesh: THREE.Mesh | null = null;

  // Reusable vectors for zero GC in physics loop
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
  public onGravityFlipped?: (sector: number, isUpsideDown: boolean) => void;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.copy(this.position);
    this.camera.up.set(0, 1, 0);

    // Disable visible parts of crawler in cockpit view
    this.crawler.group.visible = false;
  }

  public setSpawnPosition(pos: [number, number, number], yaw: number = 0, gravityInverted: boolean = false): void {
    this.setGravityInverted(gravityInverted);
    let spawnY: number;
    if (gravityInverted) {
      const ceilingY = pos[1] > 10 ? pos[1] : 20;
      spawnY = ceilingY - this.height - 0.05;
    } else {
      spawnY = pos[1] + this.height + 0.05;
    }
    this.position.set(pos[0], spawnY, pos[2]);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.releaseRope();
    this.camera.position.copy(this.position);
  }

  public setGravityInverted(inverted: boolean): void {
    const wasInverted = this.gravityMultiplier < 0;
    this.gravityMultiplier = inverted ? -1.0 : 1.0;
    this.cameraRoll = inverted ? Math.PI : 0;
    if (wasInverted !== inverted) {
      soundSynth.playGravityFlip();
      this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.32);
    }
  }

  public handleMouseMove(movementX: number, movementY: number, settings: GameSettings): void {
    const sens = settings.mouseSensitivity * 0.0022;
    // When upside down, invert horizontal steering to maintain intuitive controls
    const rollSign = this.gravityMultiplier < 0 ? -1 : 1;
    this.yaw -= movementX * sens * rollSign;
    const invert = settings.invertY ? -1 : 1;
    this.pitch -= movementY * sens * invert * rollSign;

    const maxPitch = (Math.PI / 2) - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  public queueJump(nearBeat: boolean): void {
    this.jumpBufferTimer = 0.14;

    // Jumping while rope attached releases rope with launch impulse
    if (this.isRopeAttached) {
      this.releaseRope(undefined, true);
    }

    if (nearBeat) {
      soundSynth.playBeatBonus();
      this.cameraShakeIntensity = Math.max(this.cameraShakeIntensity, 0.12);
    }
  }

  public triggerDash(inputX: number, inputZ: number, nearBeat: boolean): boolean {
    if (this.dashCooldownTimer > 0) return false;

    this.computeTangents(this._forward, this._right);
    this.dashDirection.set(0, 0, 0);

    if (Math.abs(inputX) < 0.1 && Math.abs(inputZ) < 0.1) {
      this.dashDirection.copy(this._forward);
    } else {
      this.dashDirection.addScaledVector(this._right, inputX);
      this.dashDirection.addScaledVector(this._forward, inputZ);
      this.dashDirection.normalize();
    }

    this.isDashing = true;
    this.dashTimer = 0.22;
    this.dashCooldownTimer = nearBeat ? 0.65 : 1.1;

    const speed = nearBeat ? 22.0 : 17.0;
    this.velocity.x = this.dashDirection.x * speed;
    this.velocity.z = this.dashDirection.z * speed;

    soundSynth.playDash();

    if (nearBeat) {
      soundSynth.playBeatBonus();
      this.cameraShakeIntensity = 0.28;
    }

    return true;
  }

  /**
   * Fire pulse blaster weapon (Left Mouse Click)
   */
  public firePulse(scene: THREE.Scene): void {
    if (this.pulseCooldown > 0) return;
    this.pulseCooldown = 0.28;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const startPos = this.camera.position.clone().addScaledVector(dir, 0.6);

    // Vibrant wireframe diamond projectile (scaled for full-size player)
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
      velocity: dir.clone().multiplyScalar(42),
      life: 0,
      maxLife: 2.2,
      mesh: line,
    });

    soundSynth.playPulseFire();
  }

  /**
   * Handle Climbing Rope / Grappling Tether (Right Mouse Button):
   * - Fires climbing rope towards crosshair AND begins pulling player immediately!
   * - If already attached, pulls rope with reel climb velocity boost
   */
  public handleRightClickRope(scene: THREE.Scene, mazeData: MazeData): void {
    if (!this.isRopeAttached) {
      // 1. Fire rope and immediately start hauling player towards anchor
      const hit = this.fireRope(scene, mazeData);
      if (hit) {
        this.pullRope();
      }
    } else {
      // 2. Already attached: pull rope to climb rapidly with reel boost!
      this.pullRope();
      this.velocity.multiplyScalar(1.2);
    }
  }

  /**
   * Fire rope tether towards look direction
   */
  public fireRope(scene: THREE.Scene, mazeData: MazeData): boolean {
    if (this.ropeCooldown > 0) return false;
    this.ropeCooldown = 0.2;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const hit = this.raycastWorld(this.camera.position, dir, mazeData, 60.0);
    if (!hit) {
      soundSynth.playHazardHit();
      return false;
    }

    // Anchor the rope at hit point!
    this.ropeAnchor.copy(hit.point);
    this.isRopeAttached = true;
    this.isPullingRope = false;

    // Create wire rope line mesh
    if (this.ropeLineMesh && this.ropeLineMesh.parent) {
      this.ropeLineMesh.parent.remove(this.ropeLineMesh);
    }
    const ropeGeom = new THREE.BufferGeometry().setFromPoints([
      this.camera.position,
      this.ropeAnchor
    ]);
    const ropeMat = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      linewidth: 2,
    });
    this.ropeLineMesh = new THREE.Line(ropeGeom, ropeMat);
    scene.add(this.ropeLineMesh);

    // Create glowing anchor node marker
    if (this.ropeAnchorMesh && this.ropeAnchorMesh.parent) {
      this.ropeAnchorMesh.parent.remove(this.ropeAnchorMesh);
    }
    const anchorGeom = new THREE.RingGeometry(0.25, 0.5, 8);
    const anchorMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      wireframe: true,
      side: THREE.DoubleSide
    });
    this.ropeAnchorMesh = new THREE.Mesh(anchorGeom, anchorMat);
    this.ropeAnchorMesh.position.copy(this.ropeAnchor);
    this.ropeAnchorMesh.lookAt(this.camera.position);
    scene.add(this.ropeAnchorMesh);

    soundSynth.playRopeLaunch();
    this.cameraShakeIntensity = 0.15;
    return true;
  }

  /**
   * Pull the rope (second right-click) to climb towards anchor
   */
  public pullRope(): void {
    if (!this.isRopeAttached) return;
    this.isPullingRope = true;
    soundSynth.playRopePull();
  }

  /**
   * Release rope and cleanup visual meshes
   */
  public releaseRope(scene?: THREE.Scene, boost: boolean = false): void {
    if (this.ropeLineMesh && this.ropeLineMesh.parent) {
      this.ropeLineMesh.parent.remove(this.ropeLineMesh);
      this.ropeLineMesh = null;
    }
    if (this.ropeAnchorMesh && this.ropeAnchorMesh.parent) {
      this.ropeAnchorMesh.parent.remove(this.ropeAnchorMesh);
      this.ropeAnchorMesh = null;
    }

    if (this.isRopeAttached) {
      soundSynth.playRopeRelease();
    }

    this.isRopeAttached = false;
    this.isPullingRope = false;

    if (boost) {
      // Boost upward & forward to mantle onto ledge
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.velocity.addScaledVector(fwd, 5.5);
      this.velocity.y += (this.gravityMultiplier > 0 ? 1 : -1) * 8.5;
    }
  }

  /**
   * Compute tangents relative to world horizontal plane
   */
  private computeTangents(outForward: THREE.Vector3, outRight: THREE.Vector3): void {
    outForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    outRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  public update(
    dt: number,
    heldInputs: { forward: boolean; backward: boolean; left: boolean; right: boolean; pullRope?: boolean; analogX?: number; analogZ?: number },
    mazeData: MazeData,
    settings: GameSettings,
    stats: PlayerStats,
    scene: THREE.Scene
  ): void {
    // 1. Process cooldown timers
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.pulseCooldown > 0) this.pulseCooldown -= dt;
    if (this.ropeCooldown > 0) this.ropeCooldown -= dt;
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

    // 3. Directional movement
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

    // 4. Climbing Rope Reel / Pull Physics (RMB fire/pull)
    if (this.isRopeAttached) {
      const toAnchor = this.ropeAnchor.clone().sub(this.position);
      const ropeDist = toAnchor.length();

      if (heldInputs.pullRope) {
        this.isPullingRope = true;
      }

      if (this.isPullingRope) {
        // Reeling toward anchor
        if (ropeDist < 1.8) {
          // Reached anchor! Release rope with a boost up
          this.releaseRope(scene, true);
        } else {
          // Pull player rapidly towards anchor point
          const pullDir = toAnchor.clone().normalize();
          const pullSpeed = 24.0;
          this.velocity.copy(pullDir.multiplyScalar(pullSpeed));
          this.isGrounded = false;
        }
      }

      // Update dynamic rope wire line
      if (this.ropeLineMesh) {
        const positions = new Float32Array([
          this.camera.position.x, this.camera.position.y - 0.25, this.camera.position.z,
          this.ropeAnchor.x, this.ropeAnchor.y, this.ropeAnchor.z
        ]);
        this.ropeLineMesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.ropeLineMesh.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 5. Jump logic
    if (this.jumpBufferTimer > 0) {
      if (this.isGrounded || this.coyoteTimer > 0) {
        this.velocity.y = this.gravityMultiplier * this.jumpImpulse;
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
        this.velocity.y = this.gravityMultiplier * (this.jumpImpulse * 0.9);
        this.canDoubleJump = false;
        this.jumpBufferTimer = 0;
        soundSynth.playDoubleJump();
      }
    }

    // 6. Acceleration and Friction
    if (!this.isDashing && !this.isPullingRope) {
      const targetSpeed = this.moveSpeed * (1 + Math.min(0.5, stats.beatCombo * 0.08));
      const accel = this.isGrounded ? 36 : 14;
      const friction = this.isGrounded ? 22 : 2.5;

      if (isMoving) {
        this.velocity.x += this._moveDir.x * accel * dt;
        this.velocity.z += this._moveDir.z * accel * dt;

        const horizSpd = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (horizSpd > targetSpeed) {
          this.velocity.x = (this.velocity.x / horizSpd) * targetSpeed;
          this.velocity.z = (this.velocity.z / horizSpd) * targetSpeed;
        }

        if (this.isGrounded) {
          this.headBobTimer += dt * 14;
          if (this.headBobTimer >= Math.PI) {
            this.headBobTimer -= Math.PI;
            soundSynth.playFootstep();
          }
        }
      } else {
        const horizSpd = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (horizSpd > 0.01) {
          const drop = friction * dt;
          const newSpd = Math.max(0, horizSpd - drop);
          this.velocity.x = (this.velocity.x / horizSpd) * newSpd;
          this.velocity.z = (this.velocity.z / horizSpd) * newSpd;
        } else {
          this.velocity.x = 0;
          this.velocity.z = 0;
        }
      }
    }

    // 7. Gravity (Normal: -Y; Inverted: +Y)
    if (!this.isPullingRope) {
      this.velocity.y -= this.gravityMultiplier * this.gravity * dt;
    }

    // 8. Kinematic collision handling
    const wasGrounded = this.isGrounded;
    this.isGrounded = false;

    // Movement X
    const newX = this.position.x + this.velocity.x * dt;
    if (!this.checkCollisionAt(newX, this.position.y, this.position.z, mazeData)) {
      this.position.x = newX;
    } else {
      this.velocity.x = 0;
    }

    // Movement Z
    const newZ = this.position.z + this.velocity.z * dt;
    if (!this.checkCollisionAt(this.position.x, this.position.y, newZ, mazeData)) {
      this.position.z = newZ;
    } else {
      this.velocity.z = 0;
    }

    // Movement Y with continuous swept floor / ceiling detection
    const currentY = this.position.y;
    const targetY = currentY + this.velocity.y * dt;

    if (this.gravityMultiplier > 0) {
      // Normal Gravity: floor below
      if (this.velocity.y <= 0) {
        // Falling or standing: swept floor check
        const currentFeet = currentY - this.height;
        const targetFeet = targetY - this.height;
        let landingFloorY: number | null = null;

        for (const box of mazeData.colliders) {
          if (
            this.position.x >= box.minX - this.radius &&
            this.position.x <= box.maxX + this.radius &&
            this.position.z >= box.minZ - this.radius &&
            this.position.z <= box.maxZ + this.radius
          ) {
            // Check if player feet were at or above the box top, and now passing through or on it
            if (currentFeet >= box.maxY - 0.55 && targetFeet <= box.maxY + 0.15) {
              if (landingFloorY === null || box.maxY > landingFloorY) {
                landingFloorY = box.maxY;
              }
            }
          }
        }

        // Also check active phase platforms
        for (const plat of mazeData.phasePlatforms) {
          if (!plat.active) continue;
          const hw = plat.size[0] / 2;
          const hd = plat.size[2] / 2;
          const topY = plat.position[1];
          if (
            this.position.x >= plat.position[0] - hw - this.radius &&
            this.position.x <= plat.position[0] + hw + this.radius &&
            this.position.z >= plat.position[2] - hd - this.radius &&
            this.position.z <= plat.position[2] + hd + this.radius
          ) {
            if (currentFeet >= topY - 0.55 && targetFeet <= topY + 0.15) {
              if (landingFloorY === null || topY > landingFloorY) {
                landingFloorY = topY;
              }
            }
          }
        }

        if (landingFloorY !== null) {
          this.position.y = landingFloorY + this.height;
          this.velocity.y = 0;
          this.isGrounded = true;
          this.coyoteTimer = 0.15;
          this.canDoubleJump = true;
          if (!wasGrounded) this.landSquash = 0.08;
        } else {
          this.position.y = targetY;
        }
      } else {
        // Jumping up: check ceiling collision above head
        const currentHead = currentY + this.height * 0.25;
        const targetHead = targetY + this.height * 0.25;
        let ceilingHitY: number | null = null;

        for (const box of mazeData.colliders) {
          if (
            this.position.x >= box.minX - this.radius &&
            this.position.x <= box.maxX + this.radius &&
            this.position.z >= box.minZ - this.radius &&
            this.position.z <= box.maxZ + this.radius
          ) {
            if (currentHead <= box.minY + 0.55 && targetHead >= box.minY - 0.15) {
              if (ceilingHitY === null || box.minY < ceilingHitY) {
                ceilingHitY = box.minY;
              }
            }
          }
        }

        if (ceilingHitY !== null) {
          this.position.y = ceilingHitY - this.height * 0.25 - 0.04;
          this.velocity.y = 0;
        } else {
          this.position.y = targetY;
        }
      }
    } else {
      // Inverted Gravity: ceiling above is the walking floor!
      if (this.velocity.y >= 0) {
        // Moving upward towards ceiling: swept ceiling check
        const currentHead = currentY + this.height;
        const targetHead = targetY + this.height;
        let landingCeilingY: number | null = null;

        for (const box of mazeData.colliders) {
          if (
            this.position.x >= box.minX - this.radius &&
            this.position.x <= box.maxX + this.radius &&
            this.position.z >= box.minZ - this.radius &&
            this.position.z <= box.maxZ + this.radius
          ) {
            if (currentHead <= box.minY + 0.55 && targetHead >= box.minY - 0.15) {
              if (landingCeilingY === null || box.minY < landingCeilingY) {
                landingCeilingY = box.minY;
              }
            }
          }
        }

        if (landingCeilingY !== null) {
          this.position.y = landingCeilingY - this.height;
          this.velocity.y = 0;
          this.isGrounded = true;
          this.coyoteTimer = 0.15;
          this.canDoubleJump = true;
          if (!wasGrounded) this.landSquash = 0.08;
        } else {
          this.position.y = targetY;
        }
      } else {
        // Jumping downward away from ceiling: check floor collision below
        const currentFeet = currentY - this.height * 0.25;
        const targetFeet = targetY - this.height * 0.25;
        let floorHitY: number | null = null;

        for (const box of mazeData.colliders) {
          if (
            this.position.x >= box.minX - this.radius &&
            this.position.x <= box.maxX + this.radius &&
            this.position.z >= box.minZ - this.radius &&
            this.position.z <= box.maxZ + this.radius
          ) {
            if (currentFeet >= box.maxY - 0.55 && targetFeet <= box.maxY + 0.15) {
              if (floorHitY === null || box.maxY > floorHitY) {
                floorHitY = box.maxY;
              }
            }
          }
        }

        if (floorHitY !== null) {
          this.position.y = floorHitY + this.height * 0.25 + 0.04;
          this.velocity.y = 0;
        } else {
          this.position.y = targetY;
        }
      }
    }

    // 9. Void Fall Reset
    if (this.gravityMultiplier > 0 && this.position.y < -20) {
      this.respawnAtLastCheckpoint(mazeData, stats);
    } else if (this.gravityMultiplier < 0 && this.position.y > 45) {
      this.respawnAtLastCheckpoint(mazeData, stats);
    }

    // 9.5 Dynamic Level Gravity: When jumping/moving into upside-down levels, flip gravity!
    const curZ = this.position.z;
    let sectorIn = 1;
    let isUpsideDown = false;

    if (curZ > -71) {
      sectorIn = 1;
      isUpsideDown = false;
    } else if (curZ > -165) {
      sectorIn = 2;
      isUpsideDown = true;
    } else if (curZ > -248) {
      sectorIn = 3;
      isUpsideDown = false;
    } else if (curZ > -338) {
      sectorIn = 4;
      isUpsideDown = true;
    } else if (curZ > -422) {
      sectorIn = 5;
      isUpsideDown = false;
    } else {
      sectorIn = 6;
      isUpsideDown = true;
    }

    if ((this.gravityMultiplier < 0) !== isUpsideDown) {
      this.setGravityInverted(isUpsideDown);
      stats.currentSector = sectorIn;
      this.onGravityFlipped?.(sectorIn, isUpsideDown);
    }

    // 10. Check Jump Pads
    for (const pad of mazeData.jumpPads) {
      const dx = this.position.x - pad.position[0];
      const dy = (this.position.y - this.height) - pad.position[1];
      const dz = this.position.z - pad.position[2];
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      if (distXZ <= pad.size[0] / 2 + this.radius * 0.5 && Math.abs(dy) <= 1.2) {
        if (pad.id.startsWith('pad_trans_')) {
          // Launching into upside-down level via airlock pad!
          this.setGravityInverted(true);
          const activeSec = pad.id === 'pad_trans_1' ? 2 : pad.id === 'pad_trans_3' ? 4 : 6;
          stats.currentSector = activeSec;
          this.onGravityFlipped?.(activeSec, true);
        }
        this.velocity.y = this.gravityMultiplier * pad.power;
        this.isGrounded = false;
        soundSynth.playJumpPad();
        this.cameraShakeIntensity = 0.35;
        break;
      }
    }

    // 11. Check Checkpoints
    for (const cp of mazeData.checkpoints) {
      const dx = this.position.x - cp.position[0];
      const dy = this.position.y - cp.position[1];
      const dz = this.position.z - cp.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= cp.radius) {
        if (!cp.activated) {
          cp.activated = true;
          soundSynth.playCheckpoint();
          stats.currentSector = cp.sectorIndex;
          stats.checkpointName = cp.name;

          // Check if entering an upside-down level (even sectors 2, 4, 6)
          const isEvenSector = cp.sectorIndex % 2 === 0;
          this.setGravityInverted(isEvenSector);
          soundSynth.playGravityFlip();

          const meshData = mazeData.animatedMeshes.checkpointMeshes.get(cp.id);
          if (meshData) {
            meshData.pointLight.intensity = 5;
            meshData.lightPillar.scale.set(1.4, 1, 1.4);
          }

          this.onCheckpointActivated?.(cp.name, cp.sectorIndex);

          if (cp.sectorIndex === 6 && cp.id === 'cp_victory') {
            this.onVictoryReached?.();
          }
        }
      }
    }

    // 12. Check Chronocubes
    for (const cube of mazeData.chronocubes) {
      if (cube.collected) continue;
      const dx = this.position.x - cube.position[0];
      const dy = this.position.y - cube.position[1];
      const dz = this.position.z - cube.position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= 2.2) {
        cube.collected = true;
        stats.cubesCollected++;
        stats.score += 500;
        soundSynth.playCubeCollect();
        this.cameraShakeIntensity = 0.25;

        const mesh = mazeData.animatedMeshes.cubeMeshes.get(cube.id);
        if (mesh) {
          scene.remove(mesh);
        }

        this.onCubeCollected?.(cube.id);
      }
    }

    // 13. Check Laser hazards
    const currentBeat = (Math.floor(soundSynth.getBeatProgress().beat) % 4) + 1;
    for (const laser of mazeData.lasers) {
      if (laser.activeBeats.includes(currentBeat)) {
        const p1 = new THREE.Vector3(...laser.start);
        const p2 = new THREE.Vector3(...laser.end);
        const seg = p2.clone().sub(p1);
        const segLen = seg.length();
        seg.normalize();

        const toPlayer = this.position.clone().sub(p1);
        const proj = toPlayer.dot(seg);

        if (proj >= 0 && proj <= segLen) {
          const closest = p1.clone().addScaledVector(seg, proj);
          if (closest.distanceTo(this.position) < 0.6) {
            stats.health -= laser.damage * dt * 3;
            soundSynth.playLaserSizzle();
            this.cameraShakeIntensity = 0.3;
            this.onDamageTaken?.(laser.damage * dt * 3);
          }
        }
      }
    }

    // 14. Update Pulse Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life += dt;
      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.position.copy(proj.position);

      let hit = false;
      if (this.checkCollisionAt(proj.position.x, proj.position.y, proj.position.z, mazeData)) {
        hit = true;
      }

      // Check switch target hits
      for (const sw of mazeData.switches) {
        if (!sw.activated && proj.position.distanceTo(new THREE.Vector3(...sw.position)) < sw.radius) {
          sw.activated = true;
          hit = true;
          soundSynth.playSwitchHit();
          stats.score += 250;

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

      // Check hit with hazard sentinel bots
      if (!hit && this.onCheckProjectileHit && this.onCheckProjectileHit(proj.position)) {
        hit = true;
      }

      if (hit || proj.life >= proj.maxLife) {
        scene.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 15. Smooth Camera Transform with Upside-Down Inversion
    this.baseFov = settings.fov;
    const targetFov = this.isDashing ? this.baseFov + 14 : this.baseFov;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 12, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Smoothly interpolate camera roll between 0 and 180 deg (Math.PI)
    this.currentRoll = THREE.MathUtils.damp(this.currentRoll, this.cameraRoll, 6, dt);

    // Compute Camera UP vector with roll
    const upY = Math.cos(this.currentRoll);
    const upX = Math.sin(this.currentRoll);
    this.camera.up.set(upX, upY, 0).normalize();

    const bobOffset = Math.sin(this.headBobTimer * 2) * (isMoving && this.isGrounded ? 0.05 : 0);
    const shakeX = (Math.random() * 2 - 1) * this.cameraShakeIntensity * 0.08;
    const shakeY = (Math.random() * 2 - 1) * this.cameraShakeIntensity * 0.08;

    const eyePos = this.position.clone();
    eyePos.y += this.gravityMultiplier * (bobOffset - this.landSquash);
    eyePos.x += shakeX;
    eyePos.y += shakeY;
    this.camera.position.copy(eyePos);

    // Look vector from yaw and pitch
    const lookDir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    this.camera.lookAt(eyePos.clone().add(lookDir));

    // Update PlayerStats for UI sync
    stats.dashCharge = Math.min(stats.maxDashCharge, stats.maxDashCharge * (1 - Math.max(0, this.dashCooldownTimer) / 1.1));
    stats.isGravityInverted = this.gravityMultiplier < 0;
    stats.isRopeAttached = this.isRopeAttached;
    stats.isPullingRope = this.isPullingRope;
  }

  /**
   * Raycast box intersection for climbing rope
   */
  private raycastWorld(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    mazeData: MazeData,
    maxDistance: number
  ): { point: THREE.Vector3; distance: number } | null {
    let closestDist: number = maxDistance;
    let closestPoint: THREE.Vector3 | null = null;

    for (const box of mazeData.colliders) {
      let tmin = 0.0;
      let tmax = closestDist;
      let hit = true;

      for (const axis of ['x', 'y', 'z'] as const) {
        const invD = 1.0 / (direction[axis] !== 0 ? direction[axis] : 0.0000001);
        const minVal = axis === 'x' ? box.minX : axis === 'y' ? box.minY : box.minZ;
        const maxVal = axis === 'x' ? box.maxX : axis === 'y' ? box.maxY : box.maxZ;
        let t0 = (minVal - origin[axis]) * invD;
        let t1 = (maxVal - origin[axis]) * invD;
        if (invD < 0.0) {
          const tmp = t0; t0 = t1; t1 = tmp;
        }
        tmin = Math.max(tmin, t0);
        tmax = Math.min(tmax, t1);
        if (tmax <= tmin) {
          hit = false;
          break;
        }
      }

      if (hit && tmin > 0.3 && tmin < closestDist) {
        closestDist = tmin;
        closestPoint = origin.clone().addScaledVector(direction, tmin);
      }
    }

    if (closestPoint) {
      return { point: closestPoint, distance: closestDist };
    }
    return null;
  }

  /**
   * Check static & gate collision
   */
  public checkCollisionAt(x: number, y: number, z: number, mazeData: MazeData): boolean {
    const minX = x - this.radius;
    const maxX = x + this.radius;
    // Step clearance: start 0.28m above feet so floor is not detected as a wall
    const minY = y - this.height + 0.28;
    const maxY = y + this.height * 0.15;
    const minZ = z - this.radius;
    const maxZ = z + this.radius;

    for (const box of mazeData.colliders) {
      if (box.maxY <= minY || box.minY >= maxY) continue;
      if (maxX > box.minX && minX < box.maxX && maxZ > box.minZ && minZ < box.maxZ) {
        return true;
      }
    }

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

    for (const box of mazeData.colliders) {
      if (x >= box.minX - this.radius && x <= box.maxX + this.radius &&
          z >= box.minZ - this.radius && z <= box.maxZ + this.radius) {
        if (box.maxY <= feetY + 0.35 && (highest === null || box.maxY > highest)) {
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
        if (box.minY >= y - 0.35 && (lowest === null || box.minY < lowest)) {
          lowest = box.minY;
        }
      }
    }
    return lowest;
  }

  public respawnAtLastCheckpoint(mazeData: MazeData, stats: PlayerStats): void {
    let activeCp = mazeData.checkpoints.filter(cp => cp.activated).pop();
    if (!activeCp) activeCp = mazeData.checkpoints[0];

    const isEven = activeCp.sectorIndex % 2 === 0;
    this.setSpawnPosition(activeCp.position, 0, isEven);
    this.velocity.set(0, 0, 0);
    stats.health = stats.maxHealth;
    stats.beatCombo = 0;
    this.cameraShakeIntensity = 0.5;
    soundSynth.playHazardHit();
  }
}
