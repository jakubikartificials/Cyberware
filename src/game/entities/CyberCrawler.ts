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

  public update(dt: number, speed: number = 0, isGrounded: boolean = true): void {
    const isMoving = speed > 0.1;
    const walkRate = isMoving ? 5.2 + Math.min(speed, 12) * 0.65 : 2.0;
    this.animTimer += dt * walkRate;

    // Body walking bob and stride sway
    const bodyBob = isMoving ? Math.sin(this.animTimer * 2) * 0.06 : Math.sin(this.animTimer) * 0.03;
    const currentY = this.hoverHeight + bodyBob;
    this.headWire.position.y = currentY;
    this.coreMesh.position.y = currentY + 0.22;
    this.coreLight.position.y = currentY + 0.22;
    this.tentacleWire.position.y = currentY;

    // Subtle core rotation
    this.coreMesh.rotation.y += dt * 1.5;
    this.coreMesh.rotation.x += dt * 0.8;

    const baseRadius = 0.72;
    const groundY = -this.hoverHeight; // Foot level on the walking surface

    // Procedural multi-jointed spider leg stepping animation
    for (let t = 0; t < 8; t++) {
      const ten = this.tentacles[t];
      const cosA = Math.cos(ten.baseAngle);
      const sinA = Math.sin(ten.baseAngle);

      // Joint 0: Rim hip anchor
      ten.segments[0].set(cosA * baseRadius, 0, sinA * baseRadius);

      // Check if side threat display leg in alert mode (matches enemy02_ba84c091.png)
      if (this.isAlert && (t === 2 || t === 6)) {
        const flarePhase = this.animTimer * 1.5 + t;
        ten.segments[1].set(
          cosA * baseRadius * 1.35,
          0.45 + Math.sin(flarePhase) * 0.12,
          sinA * baseRadius * 1.35
        );
        ten.segments[2].set(
          cosA * baseRadius * 1.9,
          0.95 + Math.sin(flarePhase + 0.4) * 0.18,
          sinA * baseRadius * 1.9
        );
        ten.segments[3].set(
          cosA * baseRadius * 2.5 * ten.flareMultiplier,
          1.35 + Math.sin(flarePhase + 0.8) * 0.22,
          sinA * baseRadius * 2.5 * ten.flareMultiplier
        );
        continue;
      }

      if (isMoving && isGrounded) {
        // Alternating tetrapod stepping gait (legs 0,2,4,6 vs 1,3,5,7)
        const gaitPhase = this.animTimer + (t % 2 === 0 ? 0 : Math.PI) + (t / 8) * 0.4;
        const stepCycle = Math.sin(gaitPhase);

        let footLift = 0;
        let kneeLift = 0;
        let strideOffset = 0;

        if (stepCycle > 0) {
          // SWING PHASE: Leg lifts into air, high knee arches up, foot steps forward
          footLift = Math.sin(stepCycle * Math.PI) * 0.42;
          kneeLift = Math.sin(stepCycle * Math.PI) * 0.28;
          strideOffset = -(stepCycle - 0.5) * 0.45; // Move forward in direction of motion
        } else {
          // STANCE PHASE: Foot is firmly planted on the ground, pushing body forward
          footLift = 0;
          kneeLift = 0;
          strideOffset = (-stepCycle - 0.5) * 0.45; // Move backward relative to body
        }

        // Joint 1: High spider arch knee (coxa/trochanter)
        const r1 = baseRadius * 1.32;
        ten.segments[1].set(
          cosA * r1,
          0.24 + kneeLift,
          sinA * r1
        );

        // Joint 2: Tibia knee/elbow angling downward
        const r2 = baseRadius * 1.82;
        ten.segments[2].set(
          cosA * r2,
          -0.42 + kneeLift * 0.5,
          sinA * r2
        );

        // Joint 3: Foot claw tip planted on walking floor / ceiling
        const r3 = baseRadius * 2.35 * (this.isAlert ? 1.25 : 1.0);
        ten.segments[3].set(
          cosA * r3,
          groundY + footLift,
          sinA * r3 + strideOffset
        );
      } else {
        // IDLE STANCE: All 8 feet firmly planted on ground with subtle cybernetic breathing
        const breathe = Math.sin(this.animTimer * 2.0 + t * 0.785) * 0.035;

        // Joint 1: Arched spider knee
        const r1 = baseRadius * 1.32;
        ten.segments[1].set(
          cosA * r1,
          0.22 + breathe,
          sinA * r1
        );

        // Joint 2: Angled tibia
        const r2 = baseRadius * 1.82;
        ten.segments[2].set(
          cosA * r2,
          -0.42 + breathe * 0.5,
          sinA * r2
        );

        // Joint 3: Foot tip resting on floor
        const r3 = baseRadius * 2.35;
        ten.segments[3].set(
          cosA * r3,
          groundY,
          sinA * r3
        );
      }
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
