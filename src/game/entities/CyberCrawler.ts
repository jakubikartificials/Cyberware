import * as THREE from 'three';

export interface SentinelTentacle {
  baseAngle: number;
  segments: THREE.Vector3[];
  currentTip: THREE.Vector3;
  targetTip: THREE.Vector3;
  flareMultiplier: number;
}

/**
 * Cyber Sentinel / Jellyfish Crawler
 * Exactly modeled after Blender wireframe images Enemy01_b234f765.png, enemy02_ba84c091.png, and enemy03_6437d883.png:
 * - 8-sided faceted geodesic dome head with concentric inner ring and apex crown
 * - 8 multi-jointed segmented tentacles that undulate and flare in 3D space
 * - Radiant orange wireframe aesthetic (0xff7700) matching Blender viewport
 */
export class CyberCrawler {
  public group: THREE.Group;
  public colorHex: number;
  public isPlayer: boolean;

  // Visual Meshes
  private headWire: THREE.LineSegments;
  private coreMesh: THREE.Mesh;
  private coreLight: THREE.PointLight;
  private tentacleWire: THREE.LineSegments;
  private tentacleGeom: THREE.BufferGeometry;
  private tentaclePositions: Float32Array;

  // 8 Tentacles with 4 vertices (3 segments) each
  private tentacles: SentinelTentacle[] = [];
  private animTimer: number = 0;
  public isAlert: boolean = false;
  public hoverHeight: number = 0.85;

  constructor(colorHex: number = 0xff7700, isPlayer: boolean = false) {
    this.colorHex = colorHex;
    this.isPlayer = isPlayer;
    this.group = new THREE.Group();

    // 4x bigger player (scale 1.2), while bot crawlers stay compact (scale 0.3)
    const s = this.isPlayer ? 1.2 : 0.3;
    this.group.scale.set(s, s, s);

    // =========================================================================
    // 1. Build Faceted Geodesic Dome Head matching Blender viewport screenshots
    // =========================================================================
    const headGeom = new THREE.BufferGeometry();
    const headPts: THREE.Vector3[] = [];

    const baseRadius = 0.72;
    const midRadius = 0.54;
    const innerRadius = 0.34;
    const baseY = 0.0;
    const midY = 0.32;
    const innerY = 0.32;
    const apexY = 0.54;
    const apex = new THREE.Vector3(0, apexY, 0);

    const baseVertices: THREE.Vector3[] = [];
    const midVertices: THREE.Vector3[] = [];
    const innerVertices: THREE.Vector3[] = [];

    // Calculate 8 vertices around circle for each tier
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      baseVertices.push(new THREE.Vector3(cosA * baseRadius, baseY, sinA * baseRadius));
      midVertices.push(new THREE.Vector3(cosA * midRadius, midY, sinA * midRadius));
      innerVertices.push(new THREE.Vector3(cosA * innerRadius, innerY, sinA * innerRadius));
    }

    // Connect Octagon rings
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;

      // Base perimeter ring
      headPts.push(baseVertices[i], baseVertices[next]);

      // Mid perimeter ring
      headPts.push(midVertices[i], midVertices[next]);

      // Inner concentric ring (distinctive in Blender top view)
      headPts.push(innerVertices[i], innerVertices[next]);

      // Vertical/slanted ribs from base to mid
      headPts.push(baseVertices[i], midVertices[i]);

      // Radial ribs from mid to inner ring
      headPts.push(midVertices[i], innerVertices[i]);

      // Diagonal cross brace on each facet
      headPts.push(baseVertices[i], midVertices[next]);

      // Crown ribs from inner ring to top apex
      headPts.push(innerVertices[i], apex);
    }

    headGeom.setFromPoints(headPts);

    const wireMat = new THREE.LineBasicMaterial({
      color: this.colorHex,
      linewidth: 2,
    });
    this.headWire = new THREE.LineSegments(headGeom, wireMat);
    this.headWire.position.y = this.hoverHeight;
    this.group.add(this.headWire);

    // Glowing energy core inside the sentinel dome
    const coreGeom = new THREE.OctahedronGeometry(0.18, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: this.colorHex,
      wireframe: true,
    });
    this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.coreMesh.position.y = this.hoverHeight + 0.22;
    this.group.add(this.coreMesh);

    this.coreLight = new THREE.PointLight(this.colorHex, isPlayer ? 2.5 : 1.8, 9);
    this.coreLight.position.y = this.hoverHeight + 0.22;
    this.group.add(this.coreLight);

    // =========================================================================
    // 2. Build 8 Multi-jointed Tentacles attached to dome base rim
    // =========================================================================
    // 8 tentacles x 3 segments per tentacle = 24 segments = 48 vertices
    const totalLines = 8 * 3;
    this.tentaclePositions = new Float32Array(totalLines * 2 * 3);
    this.tentacleGeom = new THREE.BufferGeometry();
    this.tentacleGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.tentaclePositions, 3)
    );

    this.tentacleWire = new THREE.LineSegments(this.tentacleGeom, wireMat);
    this.tentacleWire.position.y = this.hoverHeight;
    this.group.add(this.tentacleWire);

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      // Joint 0: base attached to rim
      const j0 = baseVertices[i].clone();
      // Joint 1: upper joint
      const j1 = new THREE.Vector3(
        j0.x * 1.15,
        j0.y - 0.55,
        j0.z * 1.15
      );
      // Joint 2: mid joint
      const j2 = new THREE.Vector3(
        j1.x * 1.25,
        j1.y - 0.75,
        j1.z * 1.25
      );
      // Joint 3: tip
      const j3 = new THREE.Vector3(
        j2.x * 1.35,
        j2.y - 0.75,
        j2.z * 1.35
      );

      // Distinguish side tentacles that flare up in enemy02_ba84c091.png
      const isSideFlare = i === 2 || i === 6;

      this.tentacles.push({
        baseAngle: angle,
        segments: [j0, j1, j2, j3],
        currentTip: j3.clone(),
        targetTip: j3.clone(),
        flareMultiplier: isSideFlare ? 1.6 : 1.0,
      });
    }

    this.updateTentacleGeometry();
  }

  public setPositionAndRotation(pos: THREE.Vector3, yaw: number, upDir?: THREE.Vector3): void {
    this.group.position.copy(pos);
    this.group.rotation.set(0, 0, 0);
    this.group.rotateY(yaw);

    if (upDir && Math.abs(upDir.y - 1) > 0.05) {
      const defaultUp = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(defaultUp, upDir);
      this.group.quaternion.premultiply(quat);
    }
  }

  public setAlertState(alert: boolean): void {
    this.isAlert = alert;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public update(dt: number, speed: number = 0, _isGrounded: boolean = true): void {
    this.animTimer += dt * (3.0 + speed * 0.4);

    // Floating breathing bob
    const bob = Math.sin(this.animTimer * 2.2) * 0.08;
    this.headWire.position.y = this.hoverHeight + bob;
    this.coreMesh.position.y = this.hoverHeight + 0.22 + bob;
    this.coreLight.position.y = this.hoverHeight + 0.22 + bob;
    this.tentacleWire.position.y = this.hoverHeight + bob;

    // Subtle core rotation
    this.coreMesh.rotation.y += dt * 1.5;
    this.coreMesh.rotation.x += dt * 0.8;

    const baseRadius = 0.72;

    // Procedural 3D tentacle waving & flaring
    for (let t = 0; t < 8; t++) {
      const ten = this.tentacles[t];
      const phase = this.animTimer + t * 0.785; // 45 deg phase offset

      const cosA = Math.cos(ten.baseAngle);
      const sinA = Math.sin(ten.baseAngle);

      // Joint 0: stays fixed to base rim
      ten.segments[0].set(cosA * baseRadius, 0, sinA * baseRadius);

      // Flare factor: expands out in alert or rapid movement (like enemy02_ba84c091.png)
      const flare = (this.isAlert ? 1.45 : 1.0) * ten.flareMultiplier;

      // Joint 1: upper joint curls down and out
      const j1Wave = Math.sin(phase) * 0.15;
      const r1 = baseRadius * (1.1 + (this.isAlert ? 0.3 : 0.05));
      ten.segments[1].set(
        cosA * r1 + sinA * j1Wave * 0.2,
        -0.55 + Math.cos(phase * 0.8) * 0.08,
        sinA * r1 - cosA * j1Wave * 0.2
      );

      // Joint 2: mid joint extends outward
      const j2Wave = Math.sin(phase + 0.6) * 0.25;
      const r2 = baseRadius * (1.4 * flare);
      // In alert mode, side tentacles sweep high into the air as in enemy02_ba84c091.png!
      const j2Height = (this.isAlert && (t === 2 || t === 6))
        ? 0.15 + Math.sin(phase) * 0.15
        : -1.25 + Math.sin(phase) * 0.12;

      ten.segments[2].set(
        cosA * r2 + sinA * j2Wave,
        j2Height,
        sinA * r2 - cosA * j2Wave
      );

      // Joint 3: tip trails in 3D with curl
      const j3Wave = Math.sin(phase + 1.2) * 0.35;
      const r3 = baseRadius * (1.85 * flare);
      const j3Height = (this.isAlert && (t === 2 || t === 6))
        ? 0.45 + Math.sin(phase + 0.4) * 0.25
        : -1.95 + Math.cos(phase) * 0.18;

      ten.segments[3].set(
        cosA * r3 + sinA * j3Wave,
        j3Height,
        sinA * r3 - cosA * j3Wave
      );
    }

    this.updateTentacleGeometry();
  }

  private updateTentacleGeometry(): void {
    let ptr = 0;
    for (let t = 0; t < 8; t++) {
      const segs = this.tentacles[t].segments;
      for (let s = 0; s < 3; s++) {
        const p1 = segs[s];
        const p2 = segs[s + 1];

        this.tentaclePositions[ptr++] = p1.x;
        this.tentaclePositions[ptr++] = p1.y;
        this.tentaclePositions[ptr++] = p1.z;

        this.tentaclePositions[ptr++] = p2.x;
        this.tentaclePositions[ptr++] = p2.y;
        this.tentaclePositions[ptr++] = p2.z;
      }
    }

    const posAttr = this.tentacleGeom.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
  }
}
