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
  // References to meshes that update every frame
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

export class MazeBuilder {
  private darkWallMat: THREE.MeshStandardMaterial;
  private whiteWireMat: THREE.LineBasicMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  private floorWireMat: THREE.LineBasicMaterial;

  constructor() {
    // Dark matte obsidian face material so walls are physically solid and occlude properly
    this.darkWallMat = new THREE.MeshStandardMaterial({
      color: 0x05070c,
      roughness: 0.9,
      metalness: 0.1,
    });

    this.whiteWireMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      linewidth: 1,
    });

    this.floorMat = new THREE.MeshStandardMaterial({
      color: 0x020306,
      roughness: 0.95,
      metalness: 0.05,
    });

    this.floorWireMat = new THREE.LineBasicMaterial({
      color: 0x334455,
      transparent: true,
      opacity: 0.5,
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

    // Helper: Add low-poly wireframe wall
    const addWall = (x: number, y: number, z: number, w: number, h: number, d: number, wireColor: number = 0xffffff) => {
      const boxGroup = new THREE.Group();
      boxGroup.position.set(x, y, z);

      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, this.darkWallMat);
      boxGroup.add(mesh);

      const edgesGeom = new THREE.EdgesGeometry(geom, 25);
      const lineMat = wireColor === 0xffffff ? this.whiteWireMat : new THREE.LineBasicMaterial({ color: wireColor });
      const wire = new THREE.LineSegments(edgesGeom, lineMat);
      boxGroup.add(wire);

      // Low poly bevel ridge accents on top
      if (h > 2) {
        const topGeom = new THREE.BufferGeometry();
        const pts = [
          new THREE.Vector3(-w/2, h/2, -d/2), new THREE.Vector3(w/2, h/2, d/2),
          new THREE.Vector3(-w/2, h/2, d/2), new THREE.Vector3(w/2, h/2, -d/2)
        ];
        topGeom.setFromPoints(pts);
        const topCross = new THREE.LineSegments(topGeom, lineMat);
        boxGroup.add(topCross);
      }

      root.add(boxGroup);

      // Collider
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });

      return boxGroup;
    };

    // Helper: Add floor section with wire grid
    const addFloor = (x: number, y: number, z: number, w: number, d: number) => {
      const geom = new THREE.BoxGeometry(w, 1, d);
      const floorMesh = new THREE.Mesh(geom, this.floorMat);
      floorMesh.position.set(x, y - 0.5, z);
      root.add(floorMesh);

      const edges = new THREE.EdgesGeometry(geom);
      const wire = new THREE.LineSegments(edges, this.floorWireMat);
      floorMesh.add(wire);

      // Wire grid lines on floor surface
      const grid = new THREE.GridHelper(Math.max(w, d), Math.max(4, Math.floor(Math.max(w, d) / 4)), 0x446688, 0x1a2433);
      grid.position.set(x, y + 0.01, z);
      root.add(grid);

      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - 1,
        maxY: y,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    };

    // Helper: Add glowing neon checkpoint
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
        activated: sectorIndex === 1, // First checkpoint active by default
        radius: 3.5,
      });

      const cpGroup = new THREE.Group();
      cpGroup.position.set(pos[0], pos[1], pos[2]);

      // Neon Portal Ring Structure
      const ringGroup = new THREE.Group();
      const ringGeom = new THREE.TorusGeometry(2.4, 0.06, 6, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
      const ringMesh1 = new THREE.Mesh(ringGeom, ringMat);
      ringMesh1.position.y = 2.4;
      ringGroup.add(ringMesh1);

      const ringMesh2 = new THREE.Mesh(ringGeom, ringMat);
      ringMesh2.position.y = 2.4;
      ringMesh2.rotation.y = Math.PI / 2;
      ringGroup.add(ringMesh2);

      // Octagonal wireframe arch posts
      const archGeom = new THREE.CylinderGeometry(0.1, 0.1, 4.8, 8);
      const archLineMat = new THREE.LineBasicMaterial({ color: colorHex });
      const archEdges = new THREE.EdgesGeometry(archGeom);
      [-2.2, 2.2].forEach(ox => {
        const post = new THREE.LineSegments(archEdges, archLineMat);
        post.position.set(ox, 2.4, 0);
        ringGroup.add(post);
      });

      cpGroup.add(ringGroup);

      // Holographic Light Pillar
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

      // Point Light
      const pointLight = new THREE.PointLight(colorHex, sectorIndex === 1 ? 4 : 1, 15);
      pointLight.position.y = 2.4;
      cpGroup.add(pointLight);

      root.add(cpGroup);

      animatedMeshes.checkpointMeshes.set(id, {
        rings: ringGroup,
        lightPillar,
        pointLight,
      });
    };

    // Helper: Add Rhythmic Jump Pad
    const addJumpPad = (
      id: string,
      pos: [number, number, number],
      power: number = 18,
      wireColor: number = 0x00f0ff
    ) => {
      jumpPads.push({
        id,
        position: pos,
        size: [2.8, 0.4, 2.8],
        power,
      });

      const padGroup = new THREE.Group();
      padGroup.position.set(pos[0], pos[1], pos[2]);

      // Base pad
      const geom = new THREE.CylinderGeometry(1.4, 1.6, 0.3, 12);
      const mesh = new THREE.Mesh(geom, this.darkWallMat);
      padGroup.add(mesh);

      const edgeGeom = new THREE.EdgesGeometry(geom);
      const edgeLine = new THREE.LineSegments(edgeGeom, new THREE.LineBasicMaterial({ color: wireColor }));
      padGroup.add(edgeLine);

      // Pulsing wire concentric ring on top
      const ringGeom = new THREE.RingGeometry(0.3, 1.2, 16);
      ringGeom.rotateX(-Math.PI / 2);
      const ringLine = new THREE.LineSegments(
        new THREE.EdgesGeometry(ringGeom),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      ringLine.position.y = 0.16;
      padGroup.add(ringLine);

      root.add(padGroup);

      animatedMeshes.jumpPadMeshes.set(id, {
        group: padGroup,
        ring: ringLine,
      });
    };

    // Helper: Add Phase-Shifting Platform
    const addPhasePlatform = (
      id: string,
      pos: [number, number, number],
      size: [number, number, number],
      phase: 'odd' | 'even'
    ) => {
      const colorHex = phase === 'odd' ? 0x00f0ff : 0xff007f;
      phasePlatforms.push({
        id,
        position: pos,
        size,
        phase,
        colorHex,
        active: phase === 'odd',
      });

      const platGroup = new THREE.Group();
      platGroup.position.set(pos[0], pos[1], pos[2]);

      const geom = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const fillMat = new THREE.MeshStandardMaterial({
        color: 0x03060c,
        roughness: 0.8,
        transparent: true,
        opacity: phase === 'odd' ? 0.9 : 0.15,
      });
      const fillMesh = new THREE.Mesh(geom, fillMat);
      platGroup.add(fillMesh);

      const edgesGeom = new THREE.EdgesGeometry(geom);
      const lineMat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: phase === 'odd' ? 1.0 : 0.2,
      });
      const lineMesh = new THREE.LineSegments(edgesGeom, lineMat);
      platGroup.add(lineMesh);

      root.add(platGroup);

      animatedMeshes.phasePlatformMeshes.set(id, {
        group: platGroup,
        lines: lineMesh,
        fill: fillMesh,
      });
    };

    // Helper: Add Low-Poly Rotating Wire Platform
    const addRotatingPlatform = (
      id: string,
      pos: [number, number, number],
      radius: number = 3.5,
      speed: number = 0.8,
      axis: 'x' | 'y' | 'z' = 'y',
      colorHex: number = 0x00f0ff
    ) => {
      rotatingPlatforms.push({
        id,
        position: pos,
        size: [radius * 2, 0.4, radius * 2],
        rotationSpeed: speed,
        axis,
        currentAngle: 0,
        colorHex,
      });

      const group = new THREE.Group();
      group.position.set(pos[0], pos[1], pos[2]);

      // Hexagonal low-poly wire cylinder cog
      const geom = new THREE.CylinderGeometry(radius, radius, 0.35, 6);
      const mesh = new THREE.Mesh(geom, this.darkWallMat);
      group.add(mesh);

      const edgeGeom = new THREE.EdgesGeometry(geom);
      const edgeLine = new THREE.LineSegments(
        edgeGeom,
        new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 })
      );
      group.add(edgeLine);

      // Low poly spokes
      const spokeGeom = new THREE.BufferGeometry();
      const spokePts: THREE.Vector3[] = [];
      for (let s = 0; s < 6; s++) {
        const ang = (s * Math.PI) / 3;
        spokePts.push(
          new THREE.Vector3(0, 0.18, 0),
          new THREE.Vector3(Math.cos(ang) * radius, 0.18, Math.sin(ang) * radius)
        );
      }
      spokeGeom.setFromPoints(spokePts);
      const spokeLine = new THREE.LineSegments(spokeGeom, new THREE.LineBasicMaterial({ color: 0xffffff }));
      group.add(spokeLine);

      // Central core node
      const centerCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3, 0),
        new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true })
      );
      centerCore.position.y = 0.3;
      group.add(centerCore);

      root.add(group);

      // Add dynamic collider covering the rotating platform
      colliders.push({
        minX: pos[0] - radius * 0.9,
        maxX: pos[0] + radius * 0.9,
        minY: pos[1] - 0.2,
        maxY: pos[1] + 0.25,
        minZ: pos[2] - radius * 0.9,
        maxZ: pos[2] + radius * 0.9,
      });

      animatedMeshes.rotatingPlatformMeshes.set(id, {
        group,
        rotationSpeed: speed,
        axis,
      });
    };

    // Helper: Add Shifting Maze Gate (Towering Maze Runner door)
    const addShiftingGate = (
      id: string,
      pos: [number, number, number],
      size: [number, number, number],
      openOffset: number = 6,
      direction: 'up' | 'x' | 'z' = 'up',
      cycleSeconds: number = 4,
      phaseOffset: number = 0,
      wireColor: number = 0xffffff
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

      const gateGroup = new THREE.Group();
      gateGroup.position.set(pos[0], pos[1], pos[2]);

      const geom = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const fillMesh = new THREE.Mesh(geom, this.darkWallMat);
      gateGroup.add(fillMesh);

      // Low poly lattice wireframe pattern across the giant door
      const edges = new THREE.EdgesGeometry(geom, 25);
      const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: wireColor }));
      gateGroup.add(wire);

      // Warning Chevron Wire Sign
      const chevGeom = new THREE.BufferGeometry();
      const hw = size[0] * 0.35;
      const hh = size[1] * 0.2;
      const chevPts = [
        new THREE.Vector3(-hw, hh, size[2]/2 + 0.05), new THREE.Vector3(0, 0, size[2]/2 + 0.05),
        new THREE.Vector3(0, 0, size[2]/2 + 0.05), new THREE.Vector3(hw, hh, size[2]/2 + 0.05),
        new THREE.Vector3(-hw, 0, size[2]/2 + 0.05), new THREE.Vector3(0, -hh, size[2]/2 + 0.05),
        new THREE.Vector3(0, -hh, size[2]/2 + 0.05), new THREE.Vector3(hw, 0, size[2]/2 + 0.05),
      ];
      chevGeom.setFromPoints(chevPts);
      const chevLine = new THREE.LineSegments(chevGeom, new THREE.LineBasicMaterial({ color: 0xffaa00 }));
      gateGroup.add(chevLine);

      root.add(gateGroup);
      animatedMeshes.gateMeshes.set(id, gateGroup);
    };

    // Helper: Add Rhythmic Laser Hazard
    const addLaser = (
      id: string,
      start: [number, number, number],
      end: [number, number, number],
      activeBeats: number[],
      colorHex: number = 0xff0055
    ) => {
      lasers.push({
        id,
        start,
        end,
        activeBeats,
        colorHex,
        damage: 25,
      });

      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...start),
        new THREE.Vector3(...end),
      ]);
      const line = new THREE.LineSegments(
        geom,
        new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 })
      );
      root.add(line);
      animatedMeshes.laserMeshes.set(id, line);
    };

    // Helper: Add Collectible Chronocube
    const addChronocube = (id: string, pos: [number, number, number], colorHex: number = 0x00f0ff) => {
      chronocubes.push({
        id,
        position: pos,
        collected: false,
        colorHex,
      });

      const cubeGroup = new THREE.Group();
      cubeGroup.position.set(pos[0], pos[1], pos[2]);

      // Nested wire cubes (hypercube style)
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

    // Helper: Add Interactive Pulse Switch Target
    const addSwitch = (id: string, pos: [number, number, number], linkedGateId?: string, colorHex: number = 0x00f0ff) => {
      switches.push({
        id,
        position: pos,
        radius: 1.2,
        activated: false,
        colorHex,
        linkedGateId,
      });

      const switchGroup = new THREE.Group();
      switchGroup.position.set(pos[0], pos[1], pos[2]);

      const baseGeom = new THREE.IcosahedronGeometry(0.8, 1);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(baseGeom),
        new THREE.LineBasicMaterial({ color: colorHex })
      );
      switchGroup.add(wire);

      const ringGeom = new THREE.TorusGeometry(1.2, 0.03, 4, 16);
      const ring = new THREE.LineSegments(
        new THREE.EdgesGeometry(ringGeom),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      );
      switchGroup.add(ring);

      root.add(switchGroup);
      animatedMeshes.switchMeshes.set(id, switchGroup);
    };

    // =========================================================================
    // LEVEL ARCHITECTURE: THE WIRE MAZE RUNNER RUN
    // =========================================================================

    // --- SECTOR 01: THE WIRE ENTRYWAY (Z: 0 to -70) ---
    // Start Platform
    addFloor(0, 0, 0, 16, 20);
    // Outer perimeter walls for start
    addWall(-8, 3, 0, 1, 6, 20);
    addWall(8, 3, 0, 1, 6, 20);
    addWall(0, 3, 10, 16, 6, 1);

    // Initial Start Checkpoint
    addCheckpoint('cp_start', 'VECTOR INITIATION', 1, [0, 0, 5], 0x00f0ff, '#00f0ff');

    // Corridor 1
    addFloor(0, 0, -20, 8, 20);
    addWall(-4, 3, -20, 1, 6, 20);
    addWall(4, 3, -20, 1, 6, 20);

    // First Chasm with Rhythmic Jump Pad
    // Gap from Z: -30 to -48 (18m deep chasm!)
    addFloor(0, -15, -40, 24, 24); // Bottom void floor
    addFloor(0, 0, -32, 8, 4); // Launch brink
    addJumpPad('pad_chasm_1', [0, 0.15, -31], 20, 0x00f0ff);

    // Chronocube in mid-air over the chasm
    addChronocube('cube_1', [0, 6, -40], 0x00f0ff);

    // Landing Platform on other side of Chasm
    addFloor(0, 0, -56, 12, 16);
    addWall(-6, 3, -56, 1, 6, 16);
    addWall(6, 3, -56, 1, 6, 16);

    // Labyrinth branching
    // Left detour with Chronocube 2
    addFloor(-10, 0, -68, 12, 8);
    addWall(-16, 3, -68, 1, 6, 8);
    addWall(-10, 3, -72, 12, 6, 1);
    addChronocube('cube_2', [-12, 1.5, -68], 0x00f0ff);

    // Center path leading to Sector 2
    addFloor(0, 0, -74, 8, 20);
    addWall(-4, 3, -78, 1, 6, 12);
    addWall(4, 3, -74, 1, 6, 20);

    // Sector 1 Finish / Checkpoint 1 (Cyan Gate)
    addCheckpoint('cp_sector_2', 'SECTOR 02: PULSE LABYRINTH', 2, [0, 0, -84], 0x00f0ff, '#00f0ff');

    // --- SECTOR 02: PULSE LABYRINTH (Z: -90 to -170) ---
    // Colossal Shifting Maze Gates (Maze Runner iconic sliding gates)
    addFloor(0, 0, -100, 16, 20);
    addWall(-8, 3.5, -100, 1, 7, 20);
    addWall(8, 3.5, -100, 1, 7, 20);

    // Shifting Gate 1 (Opens up/down on 4-beat cycle)
    addShiftingGate('gate_1', [0, 3, -98], [15, 6, 1.5], 6.5, 'up', 4, 0, 0xff007f);

    // Interactive Switch Gate room
    addFloor(0, 0, -120, 20, 20);
    addWall(-10, 3.5, -120, 1, 7, 20);
    addWall(10, 3.5, -120, 1, 7, 20);
    // Maze divider walls
    addWall(-3, 3.5, -116, 1, 7, 12);
    addWall(3, 3.5, -124, 1, 7, 12);

    // Switch on wall: shoot to open shortcut gate
    addSwitch('switch_1', [-3, 2, -110], 'gate_secret', 0x00f0ff);
    addShiftingGate('gate_secret', [0, 3, -130], [8, 6, 1.2], 6, 'up', 999999, 0, 0x00f0ff);

    // Alternate route with Rhythmic Phase Platforms over void
    // Void gap from Z: -130 to -160 with Rotating Cog Platform and Phase Platforms
    addFloor(-8, -12, -145, 16, 30); // Low void pit
    addFloor(8, -12, -145, 16, 30);
    // Rotating Platform 1: Colossal spinning wire hexagon over the chasm
    addRotatingPlatform('rot_plat_1', [0, 1.2, -145], 4.5, 0.85, 'y', 0x00f0ff);
    // Dynamic Level Disposition Shifting Gate: triggers on pulse net deploy
    addShiftingGate('gate_disp_1', [0, 3.5, -155], [12, 6, 1.2], 6, 'up', 999999, 0, 0x00f0ff);

    // Phase Platforms: Odd beats (Cyan) vs Even beats (Magenta)
    addPhasePlatform('phase_1', [-2, 0, -136], [4, 0.4, 4], 'odd');
    addPhasePlatform('phase_2', [2, 1.5, -144], [4, 0.4, 4], 'even');
    addPhasePlatform('phase_3', [-2, 3, -152], [4, 0.4, 4], 'odd');
    addPhasePlatform('phase_4', [0, 4.5, -160], [5, 0.4, 5], 'even');

    addChronocube('cube_3', [0, 6, -144], 0xff007f);

    // Sector 2 Checkpoint (Magenta Gate)
    addFloor(0, 5, -172, 14, 16);
    addWall(-7, 8, -172, 1, 6, 16);
    addWall(7, 8, -172, 1, 6, 16);
    addCheckpoint('cp_sector_3', 'SECTOR 03: KINETIC SHAFTS', 3, [0, 5, -172], 0xff007f, '#ff007f');

    // --- SECTOR 03: KINETIC SHAFTS & LASER GAUNTLETS (Z: -180 to -260) ---
    // Towering vertical platforming shaft
    addFloor(0, 5, -190, 18, 20);
    addWall(-9, 10, -190, 1, 10, 20);
    addWall(9, 10, -190, 1, 10, 20);

    // Rhythmic Laser Wire Hazards (active on beats 1 & 2)
    addLaser('laser_1', [-8.8, 6.2, -186], [8.8, 6.2, -186], [1, 2], 0xff0055);
    addLaser('laser_2', [-8.8, 6.8, -194], [8.8, 6.8, -194], [3, 0], 0xff0055);

    // Boost Pad to reach high ledge
    addJumpPad('pad_shaft_1', [0, 5.15, -198], 22, 0xffaa00);

    // High elevated wire walkway (Y: 12) with Rotating Cog and Wall Runway
    addFloor(0, 12, -215, 8, 24);
    addWall(-4, 15, -215, 1, 6, 24);
    addWall(4, 15, -215, 1, 6, 24);

    // Rotating Platform 2: Kinetic Amber Hex-Gear in vertical shaft
    addRotatingPlatform('rot_plat_2', [0, 12, -204], 3.8, -0.9, 'y', 0xffaa00);
    // Dynamic Level Disposition Shifting Gate 2
    addShiftingGate('gate_disp_2', [0, 14, -220], [8, 5, 1.2], 5, 'up', 999999, 0, 0xffaa00);

    // Laser barrier on high walkway
    addLaser('laser_3', [-3.8, 13.5, -212], [3.8, 13.5, -212], [0, 2], 0xffaa00);
    addChronocube('cube_4', [0, 14, -220], 0xffaa00);

    // Maze Runner Shifting Squeeze Gates (Horizontal sliding doors)
    addShiftingGate('gate_h1', [-3, 14, -226], [4, 5, 1.2], -4, 'x', 3, 0, 0xffaa00);
    addShiftingGate('gate_h2', [3, 14, -226], [4, 5, 1.2], 4, 'x', 3, 0, 0xffaa00);

    // Sloped leap down to Sector 4 entrance
    addFloor(0, 8, -238, 10, 16);
    addFloor(0, 4, -250, 12, 16);
    addWall(-6, 8, -250, 1, 8, 16);
    addWall(6, 8, -250, 1, 8, 16);

    // Amber Checkpoint 3
    addCheckpoint('cp_sector_4', 'SECTOR 04: THE CORE EXTRACTION', 4, [0, 4, -254], 0xffaa00, '#ffaa00');

    // --- SECTOR 04: THE CORE EXTRACTION GAUNTLET (Z: -260 to -340) ---
    // The ultimate sprint to the Emerald Extraction Core
    addFloor(0, 4, -275, 16, 30);
    addWall(-8, 8, -275, 1, 8, 30);
    addWall(8, 8, -275, 1, 8, 30);

    // Triple cascading Shifting Gates
    addShiftingGate('gate_final_1', [0, 7.5, -270], [15, 7, 1.5], 7, 'up', 4, 0, 0x00ff96);
    addShiftingGate('gate_final_2', [0, 7.5, -282], [15, 7, 1.5], 7, 'up', 4, 1, 0x00ff96);
    addShiftingGate('gate_final_3', [0, 7.5, -294], [15, 7, 1.5], 7, 'up', 4, 2, 0x00ff96);

    // Rotating Platform 3: Grand Emerald Hex Platform before Core
    addRotatingPlatform('rot_plat_3', [0, 4.2, -305], 5.2, 1.1, 'y', 0x00ff96);
    // Dynamic Level Disposition Shifting Gate 3
    addShiftingGate('gate_disp_3', [0, 6.5, -315], [14, 6.5, 1.5], 6.5, 'up', 999999, 0, 0x00ff96);

    // Mid-gauntlet Jump Pad
    addJumpPad('pad_final_boost', [0, 4.15, -288], 22, 0x00ff96);
    addChronocube('cube_5', [0, 10, -292], 0x00ff96);

    // Grand Extraction Chamber (Z: -310 to -350)
    addFloor(0, 4, -325, 36, 40);
    // Monolithic perimeter walls
    addWall(-18, 10, -325, 1, 12, 40);
    addWall(18, 10, -325, 1, 12, 40);
    addWall(0, 10, -345, 36, 12, 1);

    // Chronocube #6 in chamber
    addChronocube('cube_6', [-8, 6.5, -325], 0x00ff96);

    // Extraction Core: Rotating wire hypercube beacon
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 7.5, -330);

    const tesseractOuter = new THREE.BoxGeometry(3.5, 3.5, 3.5);
    const tesseractOuterWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(tesseractOuter),
      new THREE.LineBasicMaterial({ color: 0x00ff96, linewidth: 2 })
    );
    coreGroup.add(tesseractOuterWire);

    const tesseractInner = new THREE.OctahedronGeometry(2.0, 1);
    const tesseractInnerWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(tesseractInner),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    coreGroup.add(tesseractInnerWire);

    // Radial beam platform beneath the core
    const coreBeamGeom = new THREE.CylinderGeometry(4, 4, 0.4, 16);
    const coreBeamMesh = new THREE.Mesh(coreBeamGeom, this.darkWallMat);
    coreBeamMesh.position.y = -3.2;
    coreGroup.add(coreBeamMesh);
    const coreBeamWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(coreBeamGeom),
      new THREE.LineBasicMaterial({ color: 0x00ff96 })
    );
    coreBeamWire.position.y = -3.2;
    coreGroup.add(coreBeamWire);

    const coreLight = new THREE.PointLight(0x00ff96, 6, 25);
    coreGroup.add(coreLight);

    root.add(coreGroup);
    animatedMeshes.coreMesh = coreGroup;

    // Victory Trigger Checkpoint
    addCheckpoint('cp_victory', 'PRISMATIC CORE EXTRACTION', 5, [0, 4, -330], 0x00ff96, '#00ff96');

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
