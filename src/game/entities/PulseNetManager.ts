import * as THREE from 'three';
import { BoundingBox3D, MazeData } from '../world/MazeBuilder';
import { soundSynth } from '../audio/SoundSynth';
import { PlayerStats, PulseNetData } from '../types';

export interface ActivePulseNet {
  id: string;
  position: THREE.Vector3;
  normal: THREE.Vector3; // normal of the net plane
  width: number;
  height: number;
  duration: number;
  maxDuration: number;
  colorHex: number;
  ownerId: string;
  group: THREE.Group;
  lineMat: THREE.LineBasicMaterial;
  collider: BoundingBox3D;
  nodesGroup: THREE.Points;
}

export class PulseNetManager {
  public nets: ActivePulseNet[] = [];
  private scene: THREE.Scene;
  public onDispositionShift?: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Deploy a new temporary Pulse Net barrier
   */
  public deployNet(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    ownerId: string = 'player',
    colorHex: number = 0x00f0ff,
    width: number = 4.5,
    height: number = 3.8
  ): ActivePulseNet {
    const id = `net_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const group = new THREE.Group();
    group.position.copy(position);

    // Orient net group so it lies perpendicular to normal
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(defaultNormal, normal.clone().normalize());
    group.quaternion.copy(quat);

    // 1. Build Multi-segment Laser Grid Mesh
    const gridCols = 8;
    const gridRows = 6;
    const halfW = width / 2;
    const halfH = height / 2;

    const points: THREE.Vector3[] = [];

    // Outer border box
    points.push(
      new THREE.Vector3(-halfW, -halfH, 0), new THREE.Vector3(halfW, -halfH, 0),
      new THREE.Vector3(halfW, -halfH, 0), new THREE.Vector3(halfW, halfH, 0),
      new THREE.Vector3(halfW, halfH, 0), new THREE.Vector3(-halfW, halfH, 0),
      new THREE.Vector3(-halfW, halfH, 0), new THREE.Vector3(-halfW, -halfH, 0)
    );

    // Horizontal weave lines
    for (let r = 1; r < gridRows; r++) {
      const y = -halfH + (height * r) / gridRows;
      points.push(new THREE.Vector3(-halfW, y, 0), new THREE.Vector3(halfW, y, 0));
    }

    // Vertical weave lines
    for (let c = 1; c < gridCols; c++) {
      const x = -halfW + (width * c) / gridCols;
      points.push(new THREE.Vector3(x, -halfH, 0), new THREE.Vector3(x, halfH, 0));
    }

    // Diagonal pulse reinforcement struts
    points.push(
      new THREE.Vector3(-halfW, -halfH, 0), new THREE.Vector3(halfW, halfH, 0),
      new THREE.Vector3(-halfW, halfH, 0), new THREE.Vector3(halfW, -halfH, 0)
    );

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 2,
      transparent: true,
      opacity: 0.95,
    });
    const lineMesh = new THREE.LineSegments(geom, lineMat);
    group.add(lineMesh);

    // 2. High-energy node points at grid intersections
    const nodePoints: THREE.Vector3[] = [];
    for (let r = 0; r <= gridRows; r++) {
      for (let c = 0; c <= gridCols; c++) {
        nodePoints.push(new THREE.Vector3(
          -halfW + (width * c) / gridCols,
          -halfH + (height * r) / gridRows,
          0
        ));
      }
    }
    const nodeGeom = new THREE.BufferGeometry().setFromPoints(nodePoints);
    const nodeMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
    });
    const nodesGroup = new THREE.Points(nodeGeom, nodeMat);
    group.add(nodesGroup);

    // Glowing core point light
    const netLight = new THREE.PointLight(colorHex, 3, 10);
    group.add(netLight);

    this.scene.add(group);

    // 3. Dynamic Physical Collider ("disable walkthrough net")
    // Compute axis-aligned bounding box for the oriented barrier
    const thickness = 0.4;
    const absNorm = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
    let bx = width;
    let by = height;
    let bz = width;

    if (absNorm.z > 0.6) {
      bx = width;
      by = height;
      bz = thickness;
    } else if (absNorm.x > 0.6) {
      bx = thickness;
      by = height;
      bz = width;
    } else {
      bx = width;
      by = thickness;
      bz = height;
    }

    const collider: BoundingBox3D = {
      minX: position.x - bx / 2,
      maxX: position.x + bx / 2,
      minY: position.y - by / 2,
      maxY: position.y + by / 2,
      minZ: position.z - bz / 2,
      maxZ: position.z + bz / 2,
    };

    const maxDuration = 13.0; // 13 seconds temporary duration
    const net: ActivePulseNet = {
      id,
      position: position.clone(),
      normal: normal.clone().normalize(),
      width,
      height,
      duration: maxDuration,
      maxDuration,
      colorHex,
      ownerId,
      group,
      lineMat,
      collider,
      nodesGroup,
    };

    this.nets.push(net);

    // Play procedural electric SFX
    soundSynth.playPulseNetDeploy();
    soundSynth.playLevelShift();

    // Trigger level disposition change!
    this.onDispositionShift?.();

    return net;
  }

  /**
   * Update active nets, animate pulse oscillations, and expire old nets
   */
  public update(dt: number, mazeData: MazeData, time: number): void {
    for (let i = this.nets.length - 1; i >= 0; i--) {
      const net = this.nets[i];
      net.duration -= dt;

      // Animate electric pulse flicker & oscillation
      const remainingRatio = Math.max(0, net.duration / net.maxDuration);
      const pulseSpeed = 16 + (1 - remainingRatio) * 12;
      const flicker = 0.75 + Math.sin(time * pulseSpeed) * 0.25;

      net.lineMat.opacity = Math.min(1.0, remainingRatio * 1.5) * flicker;

      // Subtly scale / vibrate net nodes
      const vibrate = Math.sin(time * 30 + i) * 0.02;
      net.group.scale.set(1 + vibrate, 1 + vibrate, 1);

      if (net.duration <= 0) {
        // Expire net
        this.scene.remove(net.group);
        this.nets.splice(i, 1);
      }
    }
  }

  /**
   * Check if a position collides with any active pulse net barrier
   */
  public checkNetCollision(x: number, y: number, z: number, radius: number): boolean {
    for (const net of this.nets) {
      const c = net.collider;
      if (
        x + radius >= c.minX &&
        x - radius <= c.maxX &&
        y + radius >= c.minY &&
        y - radius <= c.maxY &&
        z + radius >= c.minZ &&
        z - radius <= c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if hazard bot crawler touches net; if so, shock & disintegrate it
   */
  public checkCrawlerNetTrap(pos: THREE.Vector3, stats: PlayerStats): boolean {
    for (const net of this.nets) {
      const dist = pos.distanceTo(net.position);
      if (dist < (net.width / 2 + 0.6)) {
        // Shock & eliminate hazard crawler
        soundSynth.playCrawlerDefeat();
        stats.score += 350;
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all nets on game reset
   */
  public clear(): void {
    for (const net of this.nets) {
      this.scene.remove(net.group);
    }
    this.nets = [];
  }
}
