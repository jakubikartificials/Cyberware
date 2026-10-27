import * as THREE from 'three';
import {
  Checkpoint,
  RhythmicJumpPad,
  PhasePlatform,
  ShiftingGate,
  RhythmicLaser,
  Chronocube,
  SwitchTarget
} from '../types';

export interface BoundingBox3D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface MazeData {
  group: THREE.Group;
  colliders: BoundingBox3D[];
  checkpoints: Checkpoint[];
  jumpPads: RhythmicJumpPad[];
  phasePlatforms: PhasePlatform[];
  shiftingGates: ShiftingGate[];
  lasers: RhythmicLaser[];
  chronocubes: Chronocube[];
  switches: SwitchTarget[];
  rotatingPlatforms: {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    rotationSpeed: number;
    axis: 'x' | 'y' | 'z';
    currentAngle: number;
    colorHex: number;
  }[];
  animatedMeshes: {
    gateMeshes: Map<string, THREE.Group>;
    phasePlatformMeshes: Map<string, { group: THREE.Group; lines: THREE.LineSegments; fill: THREE.Mesh }>;
    checkpointMeshes: Map<string, { rings: THREE.Group; lightPillar: THREE.Mesh; pointLight: THREE.PointLight }>;
    cubeMeshes: Map<string, THREE.Group>;
    jumpPadMeshes: Map<string, { group: THREE.Group; ring: THREE.LineSegments }>;
    laserMeshes: Map<string, THREE.LineSegments>;
    switchMeshes: Map<string, THREE.Group>;
    rotatingPlatformMeshes: Map<string, { group: THREE.Group; rotationSpeed: number; axis: 'x' | 'y' | 'z' }>;
    coreMesh?: THREE.Group;
  };
}

/**
 * Procedural Maze Builder for CYBERWIRE
 * Builds 6 Distinct Levels with Stepped Voxel Pyramids, Voxel Stalactites,
 * Perimeter Boundary Walls, and Alternating Upside-Down Gravity
 * exactly matching user screenshots:
 * - level_5ebbece9.png (Isometric stepped voxel mounds & orthogonal walls)
 * - level01_e5cb0715.png (Top-down orthogonal maze layout)
 * - level02_328e6d92.png (Inverted ceiling stalactite cavern)
 */
export class MazeBuilder {
  private darkWallMat: THREE.MeshStandardMaterial;
  private orangeWireMat: THREE.LineBasicMaterial;
  private whiteWireMat: THREE.LineBasicMaterial;
  private cyanWireMat: THREE.LineBasicMaterial;
  private floorMat: THREE.MeshStandardMaterial;

  constructor() {
    this.darkWallMat = new THREE.MeshStandardMaterial({
      color: 0x06080d,
      roughness: 0.85,
      metalness: 0.15,
    });

    // Radiant Blender viewport selection orange wireframe
    this.orangeWireMat = new THREE.LineBasicMaterial({
      color: 0xff7700,
      linewidth: 1.5,
    });

    this.whiteWireMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1,
    });

    this.cyanWireMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 1.5,
    });

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x030407,
      roughness: 0.95,
      metalness: 0.05,
    });
  }

  public buildWorld(): MazeData {
    const root = new THREE.Group();
    const colliders: BoundingBox3D[] = [];
    const checkpoints: Checkpoint[] = [];
    const jumpPads: RhythmicJumpPad[] = [];
    const phasePlatforms: PhasePlatform[] = [];
    const shiftingGates: ShiftingGate[] = [];
    const lasers: RhythmicLaser[] = [];
    const chronocubes: Chronocube[] = [];
    const switches: SwitchTarget[] = [];
    const rotatingPlatforms: {
      id: string;
      position: [number, number, number];
      size: [number, number, number];
      rotationSpeed: number;
      axis: 'x' | 'y' | 'z';
      currentAngle: number;
      colorHex: number;
    }[] = [];

    const animatedMeshes = {
      gateMeshes: new Map<string, THREE.Group>(),
      phasePlatformMeshes: new Map<string, { group: THREE.Group; lines: THREE.LineSegments; fill: THREE.Mesh }>(),
      checkpointMeshes: new Map<string, { rings: THREE.Group; lightPillar: THREE.Mesh; pointLight: THREE.PointLight }>(),
      cubeMeshes: new Map<string, THREE.Group>(),
      jumpPadMeshes: new Map<string, { group: THREE.Group; ring: THREE.LineSegments }>(),
      laserMeshes: new Map<string, THREE.LineSegments>(),
      switchMeshes: new Map<string, THREE.Group>(),
      rotatingPlatformMeshes: new Map<string, { group: THREE.Group; rotationSpeed: number; axis: 'x' | 'y' | 'z' }>(),
      coreMesh: undefined as THREE.Group | undefined,
    };

    // Helper: Add box collider
    const addCollider = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) => {
      colliders.push({ minX, maxX, minY, maxY, minZ, maxZ });
    };

    // Helper: Add solid wall block with wire edges
    const addBlock = (
      x: number, y: number, z: number,
      w: number, h: number, d: number,
      wireColor: 'orange' | 'white' | 'cyan' = 'orange'
    ) => {
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, this.darkWallMat);
      mesh.position.set(x, y, z);
      root.add(mesh);

      const edges = new THREE.EdgesGeometry(geom);
      const mat = wireColor === 'orange' ? this.orangeWireMat :
                  wireColor === 'white' ? this.whiteWireMat : this.cyanWireMat;
      const wire = new THREE.LineSegments(edges, mat);
      mesh.add(wire);

      addCollider(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2);
      return mesh;
    };

    // Helper: Add slab / floor / ceiling
    const addSlab = (x: number, y: number, z: number, w: number, d: number, isCeiling: boolean = false) => {
      const h = 0.8;
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, this.floorMat);
      mesh.position.set(x, y + (isCeiling ? h / 2 : -h / 2), z);
      root.add(mesh);

      const edges = new THREE.EdgesGeometry(geom);
      const wire = new THREE.LineSegments(edges, this.orangeWireMat);
      mesh.add(wire);

      // Grid line helper
      const grid = new THREE.GridHelper(Math.max(w, d), Math.max(4, Math.floor(Math.max(w, d) / 3)), 0xff7700, 0x332211);
      grid.position.set(x, y + (isCeiling ? -0.01 : 0.01), z);
      if (isCeiling) grid.rotation.x = Math.PI;
      root.add(grid);

      if (!isCeiling) {
        addCollider(x - w / 2, x + w / 2, y - h, y, z - d / 2, z + d / 2);
      } else {
        addCollider(x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2);
      }
    };

    // Helper: Add Outer Perimeter Boundary Box matching Blender screenshot viewport frame
    const addPerimeterBox = (
      cx: number, cy: number, cz: number,
      width: number, height: number, depth: number,
      wallThickness: number = 0.8,
      wireColor: 'orange' | 'white' | 'cyan' = 'orange'
    ) => {
      const hw = width / 2;
      const hd = depth / 2;
      const wallH = height;
      const midY = cy + wallH / 2;

      // Left & Right walls
      addBlock(cx - hw, midY, cz, wallThickness, wallH, depth, wireColor);
      addBlock(cx + hw, midY, cz, wallThickness, wallH, depth, wireColor);
      // Front & Back walls
      addBlock(cx, midY, cz - hd, width, wallH, wallThickness, wireColor);
      addBlock(cx, midY, cz + hd, width, wallH, wallThickness, wireColor);
    };

    // Helper: Add Stepped Voxel Pyramid Mounds matching level_5ebbece9.png & level02_328e6d92.png
    const addVoxelPyramid = (
      centerX: number,
      baseY: number,
      centerZ: number,
      tiers: number = 4,
      tierHeight: number = 1.0,
      tierStepWidth: number = 1.2,
      inverted: boolean = false
    ) => {
      for (let t = 0; t < tiers; t++) {
        const currentTierFromBase = t;
        const currentWidth = (tiers - currentTierFromBase) * (tierStepWidth * 2);
        const yOffset = inverted
          ? baseY - (t * tierHeight) - (tierHeight / 2)
          : baseY + (t * tierHeight) + (tierHeight / 2);

        addBlock(centerX, yOffset, centerZ, currentWidth, tierHeight, currentWidth, 'orange');
      }
    };

    // Helper: Add Voxel Ridge Mound Cluster
    const addVoxelRidge = (
      x: number, y: number, z: number,
      length: number, maxTiers: number,
      axis: 'x' | 'z',
      inverted: boolean = false
    ) => {
      for (let t = 0; t < maxTiers; t++) {
        const w = axis === 'z' ? (maxTiers - t) * 2.2 : length;
        const d = axis === 'x' ? (maxTiers - t) * 2.2 : length;
        const yPos = inverted ? y - t * 1.0 - 0.5 : y + t * 1.0 + 0.5;
        addBlock(x, yPos, z, w, 1.0, d, 'orange');
      }
    };

    // Helper: Add Checkpoint
    const addCheckpoint = (
      id: string,
      name: string,
      sectorIndex: number,
      pos: [number, number, number],
      colorHex: number,
      colorStr: string
    ) => {
      checkpoints.push({
        id,
        name,
        sectorIndex,
        position: pos,
        color: colorStr,
        colorHex,
        activated: sectorIndex === 1,
        radius: 3.5,
      });

      const cpGroup = new THREE.Group();
      cpGroup.position.set(pos[0], pos[1], pos[2]);

      const ringGeom = new THREE.TorusGeometry(2.4, 0.08, 6, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
      const ringMesh1 = new THREE.Mesh(ringGeom, ringMat);
      ringMesh1.position.y = 2.4;
      cpGroup.add(ringMesh1);

      const ringMesh2 = new THREE.Mesh(ringGeom, ringMat);
      ringMesh2.position.y = 2.4;
      ringMesh2.rotation.y = Math.PI / 2;
      cpGroup.add(ringMesh2);

      const pillarGeom = new THREE.CylinderGeometry(0.3, 0.8, 12, 12, 1, true);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: sectorIndex === 1 ? 0.35 : 0.15,
        wireframe: true,
      });
      const lightPillar = new THREE.Mesh(pillarGeom, pillarMat);
      lightPillar.position.y = 6;
      cpGroup.add(lightPillar);

      const pointLight = new THREE.PointLight(colorHex, sectorIndex === 1 ? 4 : 1, 15);
      pointLight.position.y = 2.4;
      cpGroup.add(pointLight);

      root.add(cpGroup);

      animatedMeshes.checkpointMeshes.set(id, {
        rings: cpGroup,
        lightPillar,
        pointLight,
      });
    };

    // Helper: Add Chronocube
    const addChronocube = (id: string, pos: [number, number, number], colorHex: number = 0xffaa00) => {
      chronocubes.push({
        id,
        position: pos,
        collected: false,
        colorHex,
      });

      const cubeGroup = new THREE.Group();
      cubeGroup.position.set(pos[0], pos[1], pos[2]);

      const outerGeom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      const outerWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(outerGeom),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      cubeGroup.add(outerWire);

      const innerGeom = new THREE.OctahedronGeometry(0.5, 0);
      const innerWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(innerGeom),
        new THREE.LineBasicMaterial({ color: colorHex })
      );
      cubeGroup.add(innerWire);

      root.add(cubeGroup);
      animatedMeshes.cubeMeshes.set(id, cubeGroup);
    };

    // Helper: Add Jump Pad
    const addJumpPad = (id: string, pos: [number, number, number], power: number = 20, colorHex: number = 0x00f0ff) => {
      jumpPads.push({
        id,
        position: pos,
        size: [3, 0.3, 3],
        power,
      });

      const group = new THREE.Group();
      group.position.set(pos[0], pos[1], pos[2]);

      const padGeom = new THREE.BoxGeometry(2.8, 0.2, 2.8);
      const padMesh = new THREE.Mesh(padGeom, this.darkWallMat);
      group.add(padMesh);

      const edges = new THREE.EdgesGeometry(padGeom);
      const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: colorHex }));
      group.add(edgeLine);

      const chevronGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.8, 0.12, 0.6), new THREE.Vector3(0, 0.12, -0.6),
        new THREE.Vector3(0, 0.12, -0.6), new THREE.Vector3(0.8, 0.12, 0.6),
      ]);
      const chevron = new THREE.LineSegments(chevronGeom, new THREE.LineBasicMaterial({ color: 0xffffff }));
      group.add(chevron);

      root.add(group);
      animatedMeshes.jumpPadMeshes.set(id, { group, ring: edgeLine });
    };

    // Helper: Add Shifting Gate
    const addShiftingGate = (
      id: string,
      pos: [number, number, number],
      size: [number, number, number],
      openOffset: number = 6,
      direction: 'up' | 'x' | 'z' = 'up',
      cycleSeconds: number = 4,
      phaseOffset: number = 0,
      wireColor: number = 0xff7700
    ) => {
      shiftingGates.push({
        id,
        position: pos,
        size,
        openOffset,
        direction,
        isOpen: false,
        cycleIntervalSeconds: cycleSeconds,
        phaseOffsetSeconds: phaseOffset,
        wireColorHex: wireColor,
      });

      const group = new THREE.Group();
      group.position.set(pos[0], pos[1], pos[2]);

      const geom = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const mesh = new THREE.Mesh(geom, this.darkWallMat);
      group.add(mesh);

      const edges = new THREE.EdgesGeometry(geom);
      const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: wireColor }));
      group.add(wire);

      root.add(group);
      animatedMeshes.gateMeshes.set(id, group);
    };

    // Helper: Add Rotating Hexagonal Cog Platform
    const addRotatingPlatform = (
      id: string,
      pos: [number, number, number],
      radius: number = 3.8,
      speed: number = 0.85,
      colorHex: number = 0xff7700
    ) => {
      rotatingPlatforms.push({
        id,
        position: pos,
        size: [radius * 2, 0.4, radius * 2],
        rotationSpeed: speed,
        axis: 'y',
        currentAngle: 0,
        colorHex,
      });

      const group = new THREE.Group();
      group.position.set(pos[0], pos[1], pos[2]);

      const geom = new THREE.CylinderGeometry(radius, radius, 0.35, 6);
      const mesh = new THREE.Mesh(geom, this.darkWallMat);
      group.add(mesh);

      const edgeLine = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 })
      );
      group.add(edgeLine);

      root.add(group);

      addCollider(pos[0] - radius * 0.9, pos[0] + radius * 0.9, pos[1] - 0.2, pos[1] + 0.25, pos[2] - radius * 0.9, pos[2] + radius * 0.9);
      animatedMeshes.rotatingPlatformMeshes.set(id, { group, rotationSpeed: speed, axis: 'y' });
    };

    // Helper: Add Pulse Switch
    const addSwitch = (id: string, pos: [number, number, number], linkedGateId?: string) => {
      switches.push({
        id,
        position: pos,
        radius: 1.2,
        activated: false,
        colorHex: 0x00f0ff,
        linkedGateId,
      });

      const switchGroup = new THREE.Group();
      switchGroup.position.set(pos[0], pos[1], pos[2]);

      const baseGeom = new THREE.IcosahedronGeometry(0.7, 1);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(baseGeom),
        new THREE.LineBasicMaterial({ color: 0x00f0ff })
      );
      switchGroup.add(wire);

      root.add(switchGroup);
      animatedMeshes.switchMeshes.set(id, switchGroup);
    };

    // =========================================================================
    // LEVEL 01: THE PYRAMID VAULT (Z: 0 to -70) [NORMAL GRAVITY]
    // Matches screenshot level_5ebbece9.png: Stepped voxel mounds, tall pyramids,
    // and orthogonal maze corridors.
    // =========================================================================
    addSlab(0, 0, -35, 36, 75, false);
    addPerimeterBox(0, 0, -35, 36, 6, 75, 0.8, 'orange');

    // Level 1 Checkpoint (Start)
    addCheckpoint('cp_level_1', 'LEVEL 01 // PYRAMID VAULT', 1, [0, 0, 5], 0x00f0ff, '#00f0ff');

    // Stepped voxel mounds in corners and sides matching level_5ebbece9.png
    addVoxelPyramid(-10, 0, -15, 4, 1.2, 1.3, false); // Tall Pyramid Left
    addVoxelPyramid(10, 0, -25, 5, 1.1, 1.2, false);  // Tall Pyramid Right
    addVoxelPyramid(-9, 0, -48, 4, 1.2, 1.2, false);
    addVoxelPyramid(8, 0, -58, 3, 1.2, 1.2, false);

    // Voxel stepped mountain ridge along center
    addVoxelRidge(0, 0, -36, 16, 3, 'z', false);

    // Orthogonal Maze Corridor Walls matching level01_e5cb0715.png
    addBlock(-5, 2.5, -12, 1, 5, 16, 'orange');
    addBlock(3, 2.5, -18, 10, 5, 1, 'orange');
    addBlock(5, 2.5, -28, 1, 5, 18, 'orange');
    addBlock(-2, 2.5, -34, 8, 5, 1, 'orange');
    addBlock(-6, 2.5, -42, 1, 5, 14, 'orange');
    addBlock(2, 2.5, -50, 10, 5, 1, 'orange');

    // Chronocubes on high voxel terraces
    addChronocube('cube_l1_1', [-10, 5.2, -15], 0x00f0ff);
    addChronocube('cube_l1_2', [10, 6.0, -25], 0x00f0ff);

    // Jump pad over ridge
    addJumpPad('pad_l1', [0, 0.15, -22], 18, 0x00f0ff);

    // Transition Checkpoint to Level 2 (Upside Down!)
    addCheckpoint('cp_level_2', 'LEVEL 02 // INVERTED STALACTITES', 2, [0, 0, -70], 0xffaa00, '#ffaa00');

    // =========================================================================
    // LEVEL 02: THE INVERTED STALACTITES (Z: -80 to -155) [UPSIDE DOWN!]
    // Exactly matches screenshot level02_328e6d92.png:
    // Upper ceiling slab with perimeter rim, and hanging stepped voxel stalactites!
    // Gravity is inverted (pulls toward ceiling Y=20).
    // =========================================================================
    const ceilingY2 = 20;
    addSlab(0, ceilingY2, -118, 38, 76, true);
    // Perimeter box hanging downwards from ceiling
    addPerimeterBox(0, ceilingY2 - 8, -118, 38, 8, 76, 0.8, 'orange');

    // Hanging Stepped Voxel Stalactite Spires matching level02_328e6d92.png!
    addVoxelPyramid(-11, ceilingY2, -98, 5, 1.2, 1.3, true); // Stalactite Spire 1
    addVoxelPyramid(11, ceilingY2, -108, 6, 1.1, 1.3, true); // Giant Stalactite Spire 2
    addVoxelPyramid(0, ceilingY2, -125, 5, 1.2, 1.2, true);  // Central Hanging Stalactite
    addVoxelPyramid(-9, ceilingY2, -140, 4, 1.2, 1.2, true);
    addVoxelPyramid(9, ceilingY2, -145, 5, 1.1, 1.2, true);

    // Hanging Voxel Ridges
    addVoxelRidge(-6, ceilingY2, -115, 20, 3, 'z', true);
    addVoxelRidge(6, ceilingY2, -132, 16, 3, 'z', true);

    // Inverted Hanging Maze Walls
    addBlock(-5, ceilingY2 - 2.5, -92, 1, 5, 14, 'orange');
    addBlock(4, ceilingY2 - 2.5, -102, 12, 5, 1, 'orange');
    addBlock(-3, ceilingY2 - 2.5, -115, 1, 5, 16, 'orange');
    addBlock(3, ceilingY2 - 2.5, -135, 10, 5, 1, 'orange');

    // Hanging Shifting Gate in Inverted Level
    addShiftingGate('gate_l2_1', [0, ceilingY2 - 3, -110], [14, 6, 1.5], 6, 'up', 4, 0, 0xff7700);

    // Chronocubes on hanging stalactite tips
    addChronocube('cube_l2_1', [-11, ceilingY2 - 6.5, -98], 0xffaa00);
    addChronocube('cube_l2_2', [0, ceilingY2 - 6.5, -125], 0xffaa00);

    // Switch to open shortcut
    addSwitch('sw_l2', [4, ceilingY2 - 2.5, -118], 'gate_l2_shortcut');
    addShiftingGate('gate_l2_shortcut', [0, ceilingY2 - 3, -128], [8, 6, 1.2], 6, 'up', 999999, 0, 0x00f0ff);

    // Checkpoint to Level 3 (Normal Gravity!)
    addCheckpoint('cp_level_3', 'LEVEL 03 // SPIRE GAUNTLET', 3, [0, ceilingY2 - 1, -155], 0x00ff96, '#00ff96');

    // =========================================================================
    // LEVEL 03: THE SPIRE GAUNTLET (Z: -165 to -240) [NORMAL GRAVITY]
    // High towering spires, rotating cog platforms over deep void chasm.
    // =========================================================================
    addSlab(0, 0, -175, 28, 20, false);
    addSlab(0, 0, -230, 28, 20, false);
    addPerimeterBox(0, 0, -202, 34, 10, 76, 0.8, 'orange');

    // High Voxel Spires on both flanks
    addVoxelPyramid(-10, 0, -185, 6, 1.5, 1.2, false); // 9m high spire
    addVoxelPyramid(10, 0, -195, 6, 1.5, 1.2, false);
    addVoxelPyramid(-10, 0, -220, 5, 1.4, 1.2, false);
    addVoxelPyramid(10, 0, -220, 5, 1.4, 1.2, false);

    // Deep Chasm from Z: -185 to -220 spanned by Rotating Platforms & Climbing Ropes!
    addRotatingPlatform('rot_l3_1', [0, 1.5, -192], 4.2, 0.9, 0x00ff96);
    addRotatingPlatform('rot_l3_2', [0, 2.5, -212], 4.5, -0.85, 0x00ff96);

    // Shifting Maze Gate
    addShiftingGate('gate_l3_1', [0, 4, -225], [16, 8, 1.5], 7, 'up', 4, 1, 0x00ff96);

    // Chronocube floating high between spires (reach with climbing rope!)
    addChronocube('cube_l3_1', [0, 7.5, -202], 0x00ff96);
    addChronocube('cube_l3_2', [10, 9.5, -195], 0x00ff96);

    // Checkpoint to Level 4 (Upside Down!)
    addCheckpoint('cp_level_4', 'LEVEL 04 // INVERTED CHASM', 4, [0, 0, -240], 0xff007f, '#ff007f');

    // =========================================================================
    // LEVEL 04: THE INVERTED CHASM (Z: -250 to -325) [UPSIDE DOWN!]
    // Massive inverted cavern with hanging stalactite clusters and hanging gates.
    // Ceiling Y = 22.
    // =========================================================================
    const ceilingY4 = 22;
    addSlab(0, ceilingY4, -288, 38, 76, true);
    addPerimeterBox(0, ceilingY4 - 9, -288, 38, 9, 76, 0.8, 'orange');

    // Massive Inverted Stalactite Groups
    addVoxelPyramid(-9, ceilingY4, -265, 6, 1.3, 1.2, true);
    addVoxelPyramid(9, ceilingY4, -275, 7, 1.2, 1.3, true);
    addVoxelPyramid(0, ceilingY4, -295, 6, 1.2, 1.2, true);
    addVoxelPyramid(-10, ceilingY4, -310, 5, 1.2, 1.2, true);
    addVoxelPyramid(10, ceilingY4, -315, 6, 1.2, 1.2, true);

    // Inverted maze dividers
    addBlock(-4, ceilingY4 - 3, -260, 1, 6, 16, 'orange');
    addBlock(4, ceilingY4 - 3, -280, 12, 6, 1, 'orange');
    addBlock(-3, ceilingY4 - 3, -305, 1, 6, 18, 'orange');

    // Inverted Shifting Gates
    addShiftingGate('gate_l4_1', [0, ceilingY4 - 3.5, -270], [14, 7, 1.5], 6.5, 'up', 4, 0, 0xff007f);
    addShiftingGate('gate_l4_2', [0, ceilingY4 - 3.5, -310], [14, 7, 1.5], 6.5, 'up', 4, 2, 0xff007f);

    addChronocube('cube_l4_1', [9, ceilingY4 - 8.5, -275], 0xff007f);
    addChronocube('cube_l4_2', [-9, ceilingY4 - 7.5, -265], 0xff007f);

    // Checkpoint to Level 5 (Normal Gravity!)
    addCheckpoint('cp_level_5', 'LEVEL 05 // ASCENT MONOLITH', 5, [0, ceilingY4 - 1, -325], 0xffaa00, '#ffaa00');

    // =========================================================================
    // LEVEL 05: THE ASCENT MONOLITH (Z: -335 to -410) [NORMAL GRAVITY]
    // Grand ascending stepped voxel mountain labyrinth leading to the peak.
    // =========================================================================
    addSlab(0, 0, -372, 38, 76, false);
    addPerimeterBox(0, 0, -372, 38, 12, 76, 0.8, 'orange');

    // Colossal Multi-tiered Voxel Mountain in Center
    addVoxelPyramid(0, 0, -375, 8, 1.2, 1.4, false); // 10m towering pyramid!
    addVoxelPyramid(-11, 0, -355, 5, 1.2, 1.2, false);
    addVoxelPyramid(11, 0, -355, 5, 1.2, 1.2, false);
    addVoxelPyramid(-11, 0, -395, 6, 1.2, 1.2, false);
    addVoxelPyramid(11, 0, -395, 6, 1.2, 1.2, false);

    // Ascending orthogonal maze walls
    addBlock(-5, 3.5, -345, 1, 7, 16, 'orange');
    addBlock(5, 3.5, -360, 12, 7, 1, 'orange');
    addBlock(-4, 3.5, -390, 1, 7, 18, 'orange');

    // Super Jump Pad to scale the summit
    addJumpPad('pad_l5_summit', [0, 0.15, -355], 24, 0xffaa00);

    // Chronocube on apex of the central pyramid
    addChronocube('cube_l5_1', [0, 10.2, -375], 0xffaa00);
    addChronocube('cube_l5_2', [11, 7.5, -395], 0xffaa00);

    // Checkpoint to Level 6 (Final Inverted Extraction!)
    addCheckpoint('cp_level_6', 'LEVEL 06 // INVERTED CORE APEX', 6, [0, 0, -410], 0x00f0ff, '#00f0ff');

    // =========================================================================
    // LEVEL 06: THE INVERTED CORE APEX (Z: -420 to -500) [UPSIDE DOWN!]
    // Grand Finale: The extraction core suspended from the cavern ceiling.
    // Ceiling Y = 24.
    // =========================================================================
    const ceilingY6 = 24;
    addSlab(0, ceilingY6, -460, 42, 82, true);
    addPerimeterBox(0, ceilingY6 - 12, -460, 42, 12, 82, 0.8, 'orange');

    // Grand inverted stalactites flanking the final approach
    addVoxelPyramid(-12, ceilingY6, -435, 7, 1.3, 1.3, true);
    addVoxelPyramid(12, ceilingY6, -435, 7, 1.3, 1.3, true);
    addVoxelPyramid(-12, ceilingY6, -475, 7, 1.3, 1.3, true);
    addVoxelPyramid(12, ceilingY6, -475, 7, 1.3, 1.3, true);

    // Cascading Shifting Gates to Core
    addShiftingGate('gate_final_1', [0, ceilingY6 - 4, -440], [16, 8, 1.5], 7, 'up', 4, 0, 0x00f0ff);
    addShiftingGate('gate_final_2', [0, ceilingY6 - 4, -455], [16, 8, 1.5], 7, 'up', 4, 1, 0x00f0ff);

    // Rotating Core Platform
    addRotatingPlatform('rot_core', [0, ceilingY6 - 2.5, -470], 5.5, 1.0, 0x00f0ff);

    // Chronocube in final chamber
    addChronocube('cube_l6_1', [-12, ceilingY6 - 9.5, -435], 0x00f0ff);
    addChronocube('cube_l6_2', [12, ceilingY6 - 9.5, -475], 0x00f0ff);

    // Suspended Extraction Core Tesseract Beacon
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, ceilingY6 - 5.5, -485);

    const tesseractOuter = new THREE.BoxGeometry(3.6, 3.6, 3.6);
    const tesseractOuterWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(tesseractOuter),
      new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 })
    );
    coreGroup.add(tesseractOuterWire);

    const tesseractInner = new THREE.OctahedronGeometry(2.0, 1);
    const tesseractInnerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(tesseractInner),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    coreGroup.add(tesseractInnerWire);

    const coreLight = new THREE.PointLight(0x00f0ff, 6, 30);
    coreGroup.add(coreLight);

    root.add(coreGroup);
    animatedMeshes.coreMesh = coreGroup;

    // Victory Trigger Checkpoint at the Inverted Core
    addCheckpoint('cp_victory', 'CORE EXTRACTED // MISSION VICTORY', 6, [0, ceilingY6 - 1.5, -485], 0x00f0ff, '#00f0ff');

    return {
      group: root,
      colliders,
      checkpoints,
      jumpPads,
      phasePlatforms,
      shiftingGates,
      lasers,
      chronocubes,
      switches,
      rotatingPlatforms,
      animatedMeshes,
    };
  }
}
