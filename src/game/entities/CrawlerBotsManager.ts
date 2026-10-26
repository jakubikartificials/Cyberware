import * as THREE from 'three';
import { CyberCrawler } from './CyberCrawler';
import { MazeData } from '../world/MazeBuilder';
import { soundSynth } from '../audio/SoundSynth';
import { PlayerStats } from '../types';
import { PulseNetManager } from './PulseNetManager';

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
}

export class CrawlerBotsManager {
  private scene: THREE.Scene;
  public botRunners: BotRunner[] = [];
  public hazardCrawlers: HazardCrawler[] = [];
  public totalRunnerCount: number = 4; // default: 4 runners total (Player + 3 Bot Runners)

  // Waypoints through the maze sectors for competitor runners to navigate
  private mazeWaypoints: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, -10),
    new THREE.Vector3(0, 0, -25),
    new THREE.Vector3(0, 0, -56),
    new THREE.Vector3(0, 0, -78),
    new THREE.Vector3(0, 0, -100),
    new THREE.Vector3(0, 0, -120),
    new THREE.Vector3(-2, 0, -136),
    new THREE.Vector3(2, 1.5, -144),
    new THREE.Vector3(-2, 3, -152),
    new THREE.Vector3(0, 4.5, -160),
    new THREE.Vector3(0, 5, -172),
    new THREE.Vector3(0, 5, -195),
    new THREE.Vector3(0, 12, -215),
    new THREE.Vector3(0, 8, -238),
    new THREE.Vector3(0, 4, -254),
    new THREE.Vector3(0, 4, -280),
    new THREE.Vector3(0, 4, -300),
    new THREE.Vector3(0, 4, -330), // Extraction Core
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public initBots(runnerCount: number = 4): void {
    this.clearAll();
    this.totalRunnerCount = runnerCount;

    // 1. Initialize Competitor Bot Runners (if runnerCount > 1)
    const runnerConfigs = [
      { name: 'BOT // VEX', color: 0xff007f, offset: [-2.5, 0, 4] },
      { name: 'BOT // ZEPHYR', color: 0xffaa00, offset: [2.5, 0, 4] },
      { name: 'BOT // APEX', color: 0x00ff96, offset: [-3.5, 0, 1] },
      { name: 'BOT // SHADOW', color: 0xff0055, offset: [3.5, 0, 1] },
      { name: 'BOT // PULSAR', color: 0xffea00, offset: [-2.0, 0, 8] },
      { name: 'BOT // SPECTER', color: 0x9d00ff, offset: [2.0, 0, 8] },
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

    // 2. Initialize Hazard Crawler Bots (matching user's reference image!)
    const hazardSpawns: { id: string; p1: [number, number, number]; p2: [number, number, number]; color: number }[] = [
      // Sector 1 Corridor patrol
      { id: 'hazard_1', p1: [-3, 0, -22], p2: [3, 0, -22], color: 0xff7700 }, // exact orange from reference image!
      // Sector 2 Pulse Labyrinth chaser
      { id: 'hazard_2', p1: [-4, 0, -112], p2: [4, 0, -126], color: 0xff7700 },
      // Sector 2 High phase walkway
      { id: 'hazard_3', p1: [-3, 5, -170], p2: [3, 5, -170], color: 0xff4400 },
      // Sector 3 Kinetic Shaft patrol
      { id: 'hazard_4', p1: [-4, 12, -210], p2: [4, 12, -222], color: 0xff2200 },
      // Sector 4 Core extraction perimeter guard
      { id: 'hazard_5', p1: [-10, 4, -320], p2: [10, 4, -320], color: 0xff7700 },
    ];

    for (const h of hazardSpawns) {
      const crawler = new CyberCrawler(h.color, false);
      const startPos = new THREE.Vector3(...h.p1);
      crawler.setPositionAndRotation(startPos, 0);
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
      });
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    mazeData: MazeData,
    stats: PlayerStats,
    onPlayerDamaged: (amount: number) => void,
    pulseNetManager?: PulseNetManager
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
        const dz = target.z - runner.position.z;
        const distToTarget = Math.sqrt(dx * dx + dz * dz);

        if (distToTarget < 2.5) {
          runner.currentWaypointIdx++;
          if (runner.currentWaypointIdx >= this.mazeWaypoints.length) {
            runner.finished = true;
          }
        } else {
          // Steer towards target
          const targetYaw = Math.atan2(-dx, -dz);
          runner.yaw = THREE.MathUtils.damp(runner.yaw, targetYaw, 8, dt);

          const moveDir = new THREE.Vector3(-Math.sin(runner.yaw), 0, -Math.cos(runner.yaw)).normalize();
          runner.position.addScaledVector(moveDir, runner.speed * dt);
          runner.position.y = target.y; // conform to floor altitude

          runner.crawler.setPositionAndRotation(runner.position, runner.yaw);
          runner.crawler.update(dt, runner.speed, true);
        }
      }
    }

    // 2. Update Hazard Crawler Bots
    for (const bot of this.hazardCrawlers) {
      if (!bot.alive) continue;

      // Check if hazard crawler wandered into a Pulse Net barrier
      if (pulseNetManager && pulseNetManager.checkCrawlerNetTrap(bot.position, stats)) {
        bot.alive = false;
        bot.crawler.setVisible(false);
        continue;
      }

      if (bot.stunnedTimer > 0) {
        bot.stunnedTimer -= dt;
        bot.crawler.update(dt, 0);
        continue;
      }

      if (bot.chitterCooldown > 0) bot.chitterCooldown -= dt;

      // Distance to player
      const distToPlayer = bot.position.distanceTo(playerPos);

      if (distToPlayer <= 16 && Math.abs(bot.position.y - playerPos.y) < 4) {
        // Player detected: Engage chase mode!
        bot.isChasing = true;
        const dx = playerPos.x - bot.position.x;
        const dz = playerPos.z - bot.position.z;
        const targetYaw = Math.atan2(-dx, -dz);
        bot.yaw = THREE.MathUtils.damp(bot.yaw, targetYaw, 7, dt);

        if (bot.chitterCooldown <= 0) {
          soundSynth.playCrawlerChitter();
          bot.chitterCooldown = 3.5 + Math.random() * 2;
        }

        const moveDir = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw)).normalize();
        const chaseSpeed = 5.8;
        bot.position.addScaledVector(moveDir, chaseSpeed * dt);

        bot.crawler.setPositionAndRotation(bot.position, bot.yaw);
        bot.crawler.update(dt, chaseSpeed, true);

        // Player attack collision
        if (distToPlayer <= 1.8) {
          onPlayerDamaged(bot.damage);
          soundSynth.playHazardHit();
          // Bounce back after hitting player
          bot.position.addScaledVector(moveDir, -1.2);
          bot.stunnedTimer = 0.8;
        }
      } else {
        // Normal patrol
        bot.isChasing = false;
        const dx = bot.patrolTarget.x - bot.position.x;
        const dz = bot.patrolTarget.z - bot.position.z;
        const distToPatrol = Math.sqrt(dx * dx + dz * dz);

        if (distToPatrol < 1.2) {
          // Switch target
          bot.patrolTarget = bot.patrolTarget === bot.patrolStart ? bot.patrolEnd : bot.patrolStart;
        } else {
          const targetYaw = Math.atan2(-dx, -dz);
          bot.yaw = THREE.MathUtils.damp(bot.yaw, targetYaw, 5, dt);

          const moveDir = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw)).normalize();
          const patrolSpeed = 3.2;
          bot.position.addScaledVector(moveDir, patrolSpeed * dt);

          bot.crawler.setPositionAndRotation(bot.position, bot.yaw);
          bot.crawler.update(dt, patrolSpeed, true);
        }
      }
    }
  }

  // Check if a player's pulse projectile hits any hazard crawler
  public checkPulseHit(projectilePos: THREE.Vector3, stats: PlayerStats): boolean {
    for (const bot of this.hazardCrawlers) {
      if (!bot.alive) continue;

      const dist = projectilePos.distanceTo(bot.position);
      if (dist <= 1.8) {
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
