import * as THREE from 'three';

export interface LegJoints {
  base: THREE.Vector3;   // attached to chassis
  knee: THREE.Vector3;   // high peak apex
  elbow: THREE.Vector3;  // mid angle
  foot: THREE.Vector3;   // contact with floor
  targetFoot: THREE.Vector3;
  liftProgress: number;  // 0 to 1
  isGrounded: boolean;
}

export class CyberCrawler {
  public group: THREE.Group;
  public colorHex: number;
  public isPlayer: boolean;

  // Geometry references for real-time line animation
  private chassisMesh: THREE.LineSegments;
  private coreMesh: THREE.Mesh;
  private coreLight: THREE.PointLight;
  private legLines: THREE.LineSegments[] = [];
  private jointDots: THREE.Points[] = [];

  // 6 Spider legs: 3 on left, 3 on right
  // Index 0, 1, 2 = Left (Front, Mid, Rear)
  // Index 3, 4, 5 = Right (Front, Mid, Rear)
  private legs: LegJoints[] = [];
  private walkCycleTime: number = 0;
  private baseChassisY: number = 1.3;
  public surfaceNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  constructor(colorHex: number = 0xff7700, isPlayer: boolean = false) {
    this.colorHex = colorHex;
    this.isPlayer = isPlayer;
    this.group = new THREE.Group();
    // Exactly 4 times smaller scale as requested
    this.group.scale.set(0.25, 0.25, 0.25);

    // 1. Build Central Inverted Diamond / Pyramidal Chassis matching reference image
    const chassisGeom = new THREE.BufferGeometry();
    // 4 top perimeter vertices
    const hw = 0.55;
    const hd = 0.65;
    const topY = 0.25;
    const botY = -0.35;

    const v1 = new THREE.Vector3(-hw, topY, -hd);
    const v2 = new THREE.Vector3(hw, topY, -hd);
    const v3 = new THREE.Vector3(hw, topY, hd);
    const v4 = new THREE.Vector3(-hw, topY, hd);
    const vBottom = new THREE.Vector3(0, botY, 0);

    const chassisPoints = [
      // Top loop
      v1, v2,  v2, v3,  v3, v4,  v4, v1,
      // Diagonals / inverted pyramid ribs meeting at bottom point
      v1, vBottom,
      v2, vBottom,
      v3, vBottom,
      v4, vBottom,
    ];
    chassisGeom.setFromPoints(chassisPoints);

    const lineMat = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 2,
    });
    this.chassisMesh = new THREE.LineSegments(chassisGeom, lineMat);
    this.chassisMesh.position.y = this.baseChassisY;
    this.group.add(this.chassisMesh);

    // Glowing energy core inside the chassis
    const coreGeom = new THREE.OctahedronGeometry(0.2, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
    });
    this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.coreMesh.position.y = this.baseChassisY;
    this.group.add(this.coreMesh);

    this.coreLight = new THREE.PointLight(colorHex, isPlayer ? 2.5 : 1.5, 8);
    this.coreLight.position.y = this.baseChassisY;
    this.group.add(this.coreLight);

    // 2. Build 6 Spider Legs with high peaked joints matching reference image
    // Angles for the 6 legs
    const legMounts: { side: number; zOffset: number; kneePeak: [number, number, number]; defaultFoot: [number, number, number] }[] = [
      // Left Front
      { side: -1, zOffset: -0.5, kneePeak: [-1.4, 2.7, -1.5], defaultFoot: [-1.6, 0, -1.8] },
      // Left Mid
      { side: -1, zOffset: 0.0, kneePeak: [-1.9, 2.5, 0.0], defaultFoot: [-2.1, 0, 0.0] },
      // Left Rear
      { side: -1, zOffset: 0.5, kneePeak: [-1.4, 2.6, 1.4], defaultFoot: [-1.7, 0, 1.7] },
      // Right Front
      { side: 1, zOffset: -0.5, kneePeak: [1.4, 2.7, -1.5], defaultFoot: [1.6, 0, -1.8] },
      // Right Mid
      { side: 1, zOffset: 0.0, kneePeak: [1.9, 2.5, 0.0], defaultFoot: [2.1, 0, 0.0] },
      // Right Rear
      { side: 1, zOffset: 0.5, kneePeak: [1.4, 2.6, 1.4], defaultFoot: [1.7, 0, 1.7] },
    ];

    for (let i = 0; i < 6; i++) {
      const cfg = legMounts[i];
      const basePos = new THREE.Vector3(cfg.side * hw, this.baseChassisY, cfg.zOffset);
      const kneePos = new THREE.Vector3(cfg.kneePeak[0], cfg.kneePeak[1], cfg.kneePeak[2]);
      const elbowPos = new THREE.Vector3(cfg.defaultFoot[0] * 0.85, 1.0, cfg.defaultFoot[2] * 0.85);
      const footPos = new THREE.Vector3(cfg.defaultFoot[0], 0, cfg.defaultFoot[2]);

      this.legs.push({
        base: basePos,
        knee: kneePos,
        elbow: elbowPos,
        foot: footPos.clone(),
        targetFoot: footPos.clone(),
        liftProgress: 0,
        isGrounded: true,
      });

      // Leg line geometry (base -> knee -> elbow -> foot)
      const legGeom = new THREE.BufferGeometry();
      const pts = [
        basePos.clone(), kneePos.clone(),
        kneePos.clone(), elbowPos.clone(),
        elbowPos.clone(), footPos.clone(),
      ];
      legGeom.setFromPoints(pts);

      const legLine = new THREE.LineSegments(legGeom, lineMat);
      this.group.add(legLine);
      this.legLines.push(legLine);

      // Glowing vertex joint dots
      const dotGeom = new THREE.BufferGeometry().setFromPoints([kneePos.clone(), elbowPos.clone(), footPos.clone()]);
      const dotMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.08,
      });
      const jointDot = new THREE.Points(dotGeom, dotMat);
      this.group.add(jointDot);
      this.jointDots.push(jointDot);
    }
  }

  public update(dt: number, speed: number = 0, isGrounded: boolean = true): void {
    const isMoving = speed > 0.1 && isGrounded;
    if (isMoving) {
      this.walkCycleTime += dt * Math.min(14, 6 + speed * 0.8);
    } else {
      this.walkCycleTime += dt * 1.5; // gentle idle breathing
    }

    const t = this.walkCycleTime;

    // Body bob and tilt
    const bob = isMoving ? Math.sin(t * 2) * 0.08 : Math.sin(t) * 0.03;
    const tilt = isMoving ? Math.sin(t) * 0.04 : 0;
    this.chassisMesh.position.y = this.baseChassisY + bob;
    this.coreMesh.position.y = this.baseChassisY + bob;
    this.coreLight.position.y = this.baseChassisY + bob;
    this.chassisMesh.rotation.z = tilt;
    this.chassisMesh.rotation.x = isMoving ? Math.sin(t * 2) * 0.03 : 0;

    // Animate core rotating
    this.coreMesh.rotation.x += dt * 2;
    this.coreMesh.rotation.y += dt * 3;

    // Animate 6 Legs with alternating tripod gait
    // Group A: Legs 0 (Left Front), 2 (Left Rear), 4 (Right Mid)
    // Group B: Legs 1 (Left Mid), 3 (Right Front), 5 (Right Rear)
    for (let i = 0; i < 6; i++) {
      const isGroupA = (i === 0 || i === 2 || i === 4);
      const legPhase = isGroupA ? t : t + Math.PI;

      // Leg step height and swing
      const stepLift = isMoving ? Math.max(0, Math.sin(legPhase)) * 0.5 : Math.sin(t + i) * 0.04;
      const stepReach = isMoving ? Math.cos(legPhase) * 0.4 : 0;

      const leg = this.legs[i];
      const cfgMountY = this.baseChassisY + bob;

      // Knee peak shifts dynamically as spider walks
      const kneeY = leg.knee.y + stepLift * 0.4 + bob * 0.5;
      const elbowY = Math.max(0.4, leg.elbow.y + stepLift * 0.6);
      const footY = Math.max(0, stepLift);
      const footZ = leg.targetFoot.z + stepReach;

      // Update line buffer geometry points
      const posAttr = this.legLines[i].geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      // Point 0 (Base):
      arr[0] = leg.base.x;
      arr[1] = cfgMountY;
      arr[2] = leg.base.z;

      // Point 1 (Knee):
      arr[3] = leg.knee.x;
      arr[4] = kneeY;
      arr[5] = leg.knee.z + stepReach * 0.2;

      // Point 2 (Knee):
      arr[6] = leg.knee.x;
      arr[7] = kneeY;
      arr[8] = leg.knee.z + stepReach * 0.2;

      // Point 3 (Elbow):
      arr[9] = leg.elbow.x;
      arr[10] = elbowY;
      arr[11] = leg.elbow.z + stepReach * 0.5;

      // Point 4 (Elbow):
      arr[12] = leg.elbow.x;
      arr[13] = elbowY;
      arr[14] = leg.elbow.z + stepReach * 0.5;

      // Point 5 (Foot contact):
      arr[15] = leg.foot.x;
      arr[16] = footY;
      arr[17] = footZ;

      posAttr.needsUpdate = true;

      // Update joint dots
      const dotAttr = this.jointDots[i].geometry.attributes.position as THREE.BufferAttribute;
      const dArr = dotAttr.array as Float32Array;
      dArr[0] = leg.knee.x; dArr[1] = kneeY; dArr[2] = leg.knee.z + stepReach * 0.2;
      dArr[3] = leg.elbow.x; dArr[4] = elbowY; dArr[5] = leg.elbow.z + stepReach * 0.5;
      dArr[6] = leg.foot.x; dArr[7] = footY; dArr[8] = footZ;
      dotAttr.needsUpdate = true;
    }
  }

  public setPositionAndRotation(pos: THREE.Vector3, yaw: number, surfaceNormal?: THREE.Vector3): void {
    this.group.position.copy(pos);
    if (!surfaceNormal || Math.abs(surfaceNormal.y - 1) < 0.05) {
      // Standard floor orientation
      this.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    } else {
      // Wall / ceiling orientation: orient group up vector to surface normal
      const targetUp = surfaceNormal.clone().normalize();
      const defaultUp = new THREE.Vector3(0, 1, 0);
      const quatAlign = new THREE.Quaternion().setFromUnitVectors(defaultUp, targetUp);
      const quatYaw = new THREE.Quaternion().setFromAxisAngle(targetUp, yaw);
      this.group.quaternion.copy(quatAlign.multiply(quatYaw));
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
