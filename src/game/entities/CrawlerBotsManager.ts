import * as THREE from 'three';
import { CyberCrawler } from './CyberCrawler';
import { MazeData } from '../world/MazeBuilder';
import { soundSynth } from '../audio/SoundSynth';
import { PlayerStats } from '../types';

export interface BotRunner {
  id: string;
  name: string;
  crawler: CyberCrawler;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  currentWaypointIdx: number;
  sector: number;
  speed: number;
  finished: boolean;
  colorHex: number;
}

export interface HazardCrawler {
  id: string;
  crawler: CyberCrawler;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;
  patrolStart: THREE.Vector3;
  patrolEnd: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  isChasing: boolean;
  health: number;
  maxHealth: number;
  stunnedTimer: number;
  alive: boolean;
  damage: number;
  chitterCooldown: number;
  isInvertedLevel?: boolean;
}

export class CrawlerBotsManager {
  private scene: THREE.Scene;
  public botRunners: BotRunner[] = [];
  public hazardCrawlers: HazardCrawler[] = [];
  public totalRunnerCount: number = 4;

  // Waypoints through all 6 levels
  private mazeWaypoints: THREE.Vector3[] = [
    // Level 1: Normal
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, -25),
    new THREE.Vector3(0, 0, -50),
    new THREE.Vector3(0, 0, -70),
    // Level 2: Inverted (Ceiling at Y=20)
    new THREE.Vector3(0, 19, -95),
    new THREE.Vector3(0, 19, -120),
    new THREE.Vector3(0, 19, -145),
    new THREE.Vector3(0, 19, -155),
    // Level 3: Normal
    new THREE.Vector3(0, 0, -180),
    new THREE.Vector3(0, 1.5, -200),
    new THREE.Vector3(0, 0, -230),
    new THREE.Vector3(0, 0, -240),
    // Level 4: Inverted (Ceiling at Y=22)
    new THREE.Vector3(0, 21, -270),
    new THREE.Vector3(0, 21, -295),
    new THREE.Vector3(0, 21, -325),
    // Level 5: Normal
    new THREE.Vector3(0, 0, -350),
    new THREE.Vector3(0, 5, -375),
    new THREE.Vector3(0, 0, -400),
    new THREE.Vector3(0, 0, -410),
    // Level 6: Inverted Core (Ceiling at Y=24)
    new THREE.Vector3(0, 23, -440),
    new THREE.Vector3(0, 23, -465),
    new THREE.Vector3(0, 22.5, -485),
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public initBots(runnerCount: number = 4): void {
    this.clearAll();
    this.totalRunnerCount = runnerCount;

    // 1. Initialize Competitor Bot Runners (if runnerCount > 1)
    const runnerConfigs = [
      { name: 'SENTINEL // VEX', color: 0xff7700, offset: [-2.5, 0, 4] },
      { name: 'SENTINEL // ZEPHYR', color: 0xffaa00, offset: [2.5, 0, 4] },
      { name: 'SENTINEL // APEX', color: 0x00ff96, offset: [-3.5, 0, 1] },
      { name: 'SENTINEL // SHADOW', color: 0xff0055, offset: [3.5, 0, 1] },
      { name: 'SENTINEL // PULSAR', color: 0xffea00, offset: [-2.0, 0, 8] },
      { name: 'SENTINEL // SPECTER', color: 0x9d00ff, offset: [2.0, 0, 8] },
    ];

    const competitorsToAdd = Math.max(0, runnerCount - 1);
    for (let i = 0; i < competitorsToAdd && i < runnerConfigs.length; i++) {
      const cfg = runnerConfigs[i];
      const crawler = new CyberCrawler(cfg.color, false);
      const startPos = new THREE.Vector3(cfg.offset[0], cfg.offset[1], cfg.offset[2]);
      crawler.setPositionAndRotation(startPos, 0);
      this.scene.add(crawler.group);

      this.botRunners.push({
        id: `runner_${i}`,
        name: cfg.name,
        crawler,
        position: startPos,
        velocity: new THREE.Vector3(),
        yaw: 0,
        currentWaypointIdx: 0,
        sector: 1,
        speed: 7.5 + Math.random() * 2.2,
        finished: false,
        colorHex: cfg.color,
      });
    }

    // 2. Initialize Hazard Sentinel Bots matching the user's Blender images
    // Radiant wireframe orange (0xff7700) with 8 segmented tentacles
    const hazardSpawns: { id: string; p1: [number, number, number]; p2: [number, number, number]; color: number; inverted?: boolean }[] = [
      // Level 1: Normal Pyramid Vault
      { id: 'hazard_l1_1', p1: [-3, 0.5, -20], p2: [3, 0.5, -20], color: 0xff7700 },
      { id: 'hazard_l1_2', p1: [-4, 0.5, -45], p2: [4, 0.5, -45], color: 0xff7700 },

      // Level 2: Inverted Stalactites (Hanging from ceiling Y=20)
      { id: 'hazard_l2_1', p1: [-4, 18.5, -105], p2: [4, 18.5, -105], color: 0xff7700, inverted: true },
      { id: 'hazard_l2_2', p1: [-5, 18.5, -135], p2: [5, 18.5, -135], color: 0xff7700, inverted: true },

      // Level 3: Spire Gauntlet
      { id: 'hazard_l3_1', p1: [-4, 1.0, -185], p2: [4, 1.0, -185], color: 0xff7700 },
      { id: 'hazard_l3_2', p1: [-3, 1.0, -225], p2: [3, 1.0, -225], color: 0xff7700 },

      // Level 4: Inverted Chasm (Hanging from ceiling Y=22)
      { id: 'hazard_l4_1', p1: [-4, 20.5, -280], p2: [4, 20.5, -280], color: 0xff7700, inverted: true },
      { id: 'hazard_l4_2', p1: [-4, 20.5, -310], p2: [4, 20.5, -310], color: 0xff7700, inverted: true },

      // Level 5: Ascent Monolith
      { id: 'hazard_l5_1', p1: [-5, 1.0, -360], p2: [5, 1.0, -360], color: 0xff7700 },
      { id: 'hazard_l5_2', p1: [-4, 1.0, -395], p2: [4, 1.0, -395], color: 0xff7700 },

      // Level 6: Inverted Core Apex (Ceiling Y=24)
      { id: 'hazard_l6_1', p1: [-6, 22.0, -450], p2: [6, 22.0, -450], color: 0xff7700, inverted: true },
      { id: 'hazard_l6_2', p1: [-6, 22.0, -475], p2: [6, 22.0, -475], color: 0xff7700, inverted: true },
    ];

    for (const h of hazardSpawns) {
      const crawler = new CyberCrawler(h.color, false);
      const startPos = new THREE.Vector3(...h.p1);
      const upDir = h.inverted ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);
      crawler.setPositionAndRotation(startPos, 0, upDir);
      this.scene.add(crawler.group);

      this.hazardCrawlers.push({
        id: h.id,
        crawler,
        position: startPos.clone(),
        velocity: new THREE.Vector3(),
        yaw: 0,
        patrolStart: new THREE.Vector3(...h.p1),
        patrolEnd: new THREE.Vector3(...h.p2),
        patrolTarget: new THREE.Vector3(...h.p2),
        isChasing: false,
        health: 20,
        maxHealth: 20,
        stunnedTimer: 0,
        alive: true,
        damage: 15,
        chitterCooldown: Math.random() * 2,
        isInvertedLevel: !!h.inverted,
      });
    }
  }

  public setSectorGravity(sector: number, isUpsideDown: boolean): void {
    for (const bot of this.hazardCrawlers) {
      const z = bot.position.z;
      const botSector = 
        z > -71 ? 1 :
        z > -165 ? 2 :
        z > -248 ? 3 :
        z > -338 ? 4 :
        z > -422 ? 5 : 6;
      if (botSector === sector) {
        bot.isInvertedLevel = isUpsideDown;
      }
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    _mazeData: MazeData,
    _stats: PlayerStats,
    onPlayerDamaged: (amount: number) => void
  ): void {
    // 1. Update Competitor Bot Runners
    for (const runner of this.botRunners) {
      if (runner.finished) {
        runner.crawler.update(dt, 0);
        continue;
      }

      const target = this.mazeWaypoints[runner.currentWaypointIdx];
      if (target) {
        const dx = target.x - runner.position.x;
        const dy = target.y - runner.position.y;
        const dz = target.z - runner.position.z;
        const distToTarget = Math.sqrt(dx * dx + dz * dz);

        if (distToTarget < 2.5) {
          runner.currentWaypointIdx++;
          if (runner.currentWaypointIdx >= this.mazeWaypoints.length) {
            runner.finished = true;
          }
        } else {
          const targetYaw = Math.atan2(-dx, -dz);
          runner.yaw = THREE.MathUtils.damp(runner.yaw, targetYaw, 8, dt);

          const moveDir = new THREE.Vector3(-Math.sin(runner.yaw), 0, -Math.cos(runner.yaw)).normalize();
          runner.position.addScaledVector(moveDir, runner.speed * dt);
          runner.position.y = THREE.MathUtils.damp(runner.position.y, target.y, 6, dt);

          // Dynamic gravity for competitor runners
          const rz = runner.position.z;
          const isEvenLevel = target.y > 10 || (rz <= -71 && rz > -165) || (rz <= -248 && rz > -338) || (rz <= -422);
          const upDir = isEvenLevel ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);
          runner.crawler.setPositionAndRotation(runner.position, runner.yaw, upDir);
          runner.crawler.update(dt, runner.speed, true);
        }
      }
    }

    // 2. Update Hazard Sentinel Bots
    for (const bot of this.hazardCrawlers) {
      if (!bot.alive) continue;

      if (bot.stunnedTimer > 0) {
        bot.stunnedTimer -= dt;
        bot.crawler.update(dt, 0);
        continue;
      }

      if (bot.chitterCooldown > 0) bot.chitterCooldown -= dt;

      // Dynamic gravity detection based on current level position
      const botZ = bot.position.z;
      const isUpsideDownLevel = 
        (botZ <= -71 && botZ > -165) || // Level 2: Inverted Stalactites (Ceiling Y=20)
        (botZ <= -248 && botZ > -338) || // Level 4: Inverted Chasm (Ceiling Y=22)
        (botZ <= -422); // Level 6: Inverted Core Apex (Ceiling Y=24)

      bot.isInvertedLevel = isUpsideDownLevel;

      // Adjust height to attach and walk on ceiling if inverted, or floor if normal
      let targetWalkY = 0.85;
      if (bot.isInvertedLevel) {
        if (botZ <= -422) {
          targetWalkY = 24 - 0.85; // Level 6
        } else if (botZ <= -248) {
          targetWalkY = 22 - 0.85; // Level 4
        } else {
          targetWalkY = 20 - 0.85; // Level 2
        }
      }
      bot.position.y = THREE.MathUtils.damp(bot.position.y, targetWalkY, 8, dt);

      const distToPlayer = bot.position.distanceTo(playerPos);
      const upDir = bot.isInvertedLevel ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);

      if (distToPlayer <= 20 && Math.abs(bot.position.y - playerPos.y) < 10) {
        // Player detected: Flare threat display and engage chase! (matches enemy02_ba84c091.png)
        bot.isChasing = true;
        bot.crawler.setAlertState(true);

        const dx = playerPos.x - bot.position.x;
        const dz = playerPos.z - bot.position.z;
        const targetYaw = Math.atan2(-dx, -dz);
        bot.yaw = THREE.MathUtils.damp(bot.yaw, targetYaw, 7, dt);

        if (bot.chitterCooldown <= 0) {
          soundSynth.playCrawlerChitter();
          bot.chitterCooldown = 3.5 + Math.random() * 2;
        }

        const moveDir = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw)).normalize();
        const chaseSpeed = 6.2;
        bot.position.addScaledVector(moveDir, chaseSpeed * dt);

        bot.crawler.setPositionAndRotation(bot.position, bot.yaw, upDir);
        bot.crawler.update(dt, chaseSpeed, true);

        // Player collision damage (adapted for 4x player radius)
        if (distToPlayer <= 2.2) {
          onPlayerDamaged(bot.damage);
          soundSynth.playHazardHit();
          bot.position.addScaledVector(moveDir, -1.5);
          bot.stunnedTimer = 0.8;
        }
      } else {
        // Normal patrol: walking on legs along floor/ceiling
        bot.isChasing = false;
        bot.crawler.setAlertState(false);

        const dx = bot.patrolTarget.x - bot.position.x;
        const dz = bot.patrolTarget.z - bot.position.z;
        const distToPatrol = Math.sqrt(dx * dx + dz * dz);

        if (distToPatrol < 1.4) {
          bot.patrolTarget = bot.patrolTarget === bot.patrolStart ? bot.patrolEnd : bot.patrolStart;
        } else {
          const targetYaw = Math.atan2(-dx, -dz);
          bot.yaw = THREE.MathUtils.damp(bot.yaw, targetYaw, 5, dt);

          const moveDir = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw)).normalize();
          const patrolSpeed = 3.4;
          bot.position.addScaledVector(moveDir, patrolSpeed * dt);

          bot.crawler.setPositionAndRotation(bot.position, bot.yaw, upDir);
          bot.crawler.update(dt, patrolSpeed, true);
        }
      }
    }
  }

  public checkPulseHit(projectilePos: THREE.Vector3, stats: PlayerStats): boolean {
    for (const bot of this.hazardCrawlers) {
      if (!bot.alive) continue;

      const dist = projectilePos.distanceTo(bot.position);
      if (dist <= 2.2) {
        bot.health -= 20;
        if (bot.health <= 0) {
          bot.alive = false;
          this.scene.remove(bot.crawler.group);
          soundSynth.playCrawlerDefeat();
          stats.score += 300 * (1 + stats.beatCombo * 0.2);
          return true;
        } else {
          bot.stunnedTimer = 1.0;
          return true;
        }
      }
    }
    return false;
  }

  public clearAll(): void {
    for (const runner of this.botRunners) {
      this.scene.remove(runner.crawler.group);
    }
    for (const hazard of this.hazardCrawlers) {
      this.scene.remove(hazard.crawler.group);
    }
    this.botRunners = [];
    this.hazardCrawlers = [];
  }
}
