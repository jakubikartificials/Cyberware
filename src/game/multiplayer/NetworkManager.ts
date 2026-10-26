import * as THREE from 'three';
import Peer, { DataConnection } from 'peerjs';
import { CyberCrawler } from '../entities/CyberCrawler';
import { MultiplayerPlayerState } from '../types';

export type MultiplayerRole = 'none' | 'host' | 'client';

export class NetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  public role: MultiplayerRole = 'none';
  public roomCode: string = '';
  public isConnected: boolean = false;
  public pingMs: number = 0;

  // Remote Player 2 3D Model & State
  public remoteState: MultiplayerPlayerState | null = null;
  public remoteCrawler: CyberCrawler | null = null;
  private scene: THREE.Scene;

  // Callbacks
  public onConnectionEstablished?: () => void;
  public onConnectionLost?: () => void;
  public onRemotePulseFired?: (pos: [number, number, number], dir: [number, number, number]) => void;
  public onRemoteNetDeployed?: (pos: [number, number, number], norm: [number, number, number]) => void;
  public onRemoteDispositionShift?: () => void;

  private sendTimer: number = 0;
  private lastPingSentTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Host an online 2-player match
   */
  public hostRoom(onReady: (code: string) => void, onError: (err: string) => void): void {
    this.cleanup();
    this.role = 'host';

    // Generate random 4-letter room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.roomCode = code;

    const peerId = `cyberwire-${code.toLowerCase()}`;
    this.peer = new Peer(peerId, {
      debug: 1,
    });

    this.peer.on('open', () => {
      this.initRemoteCrawler(0xff007f); // Player 2 is Magenta Cyber Crawler
      onReady(this.roomCode);
    });

    this.peer.on('connection', (connection) => {
      this.conn = connection;
      this.setupConnectionHandlers();
    });

    this.peer.on('error', (err) => {
      onError(err.message || 'Connection error');
    });
  }

  /**
   * Join an existing online 2-player match
   */
  public joinRoom(code: string, onSuccess: () => void, onError: (err: string) => void): void {
    this.cleanup();
    this.role = 'client';
    this.roomCode = code.toUpperCase().trim();

    this.peer = new Peer({
      debug: 1,
    });

    this.peer.on('open', () => {
      this.initRemoteCrawler(0x00f0ff); // Host is Cyan Cyber Crawler
      const targetPeerId = `cyberwire-${this.roomCode.toLowerCase()}`;
      this.conn = this.peer!.connect(targetPeerId, {
        reliable: false, // UDP-like low latency for 3D state
      });

      this.setupConnectionHandlers();

      this.conn.on('open', () => {
        onSuccess();
      });
    });

    this.peer.on('error', (err) => {
      onError(err.message || 'Failed to connect to host');
    });
  }

  private initRemoteCrawler(colorHex: number): void {
    if (this.remoteCrawler) {
      this.scene.remove(this.remoteCrawler.group);
    }
    this.remoteCrawler = new CyberCrawler(colorHex, false);
    this.remoteCrawler.setVisible(false);
    this.scene.add(this.remoteCrawler.group);
  }

  private setupConnectionHandlers(): void {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.isConnected = true;
      if (this.remoteCrawler) {
        this.remoteCrawler.setVisible(true);
      }
      this.onConnectionEstablished?.();
    });

    this.conn.on('data', (data: unknown) => {
      this.handleIncomingData(data);
    });

    this.conn.on('close', () => {
      this.isConnected = false;
      if (this.remoteCrawler) {
        this.remoteCrawler.setVisible(false);
      }
      this.onConnectionLost?.();
    });

    this.conn.on('error', () => {
      this.isConnected = false;
      this.onConnectionLost?.();
    });
  }

  private handleIncomingData(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const msg = data as Record<string, any>;

    if (msg.type === 'state') {
      this.remoteState = msg.payload as MultiplayerPlayerState;
      if (this.remoteCrawler && this.remoteState) {
        this.remoteCrawler.setVisible(true);
        const pos = new THREE.Vector3(...this.remoteState.position);
        const norm = new THREE.Vector3(...this.remoteState.surfaceNormal);
        this.remoteCrawler.setPositionAndRotation(pos, this.remoteState.yaw, norm);
        this.remoteCrawler.update(0.016, this.remoteState.speed, this.remoteState.isGrounded);
      }
    } else if (msg.type === 'pulse') {
      this.onRemotePulseFired?.(msg.pos, msg.dir);
    } else if (msg.type === 'net') {
      this.onRemoteNetDeployed?.(msg.pos, msg.norm);
    } else if (msg.type === 'disposition') {
      this.onRemoteDispositionShift?.();
    } else if (msg.type === 'ping') {
      this.conn?.send({ type: 'pong', sentAt: msg.sentAt });
    } else if (msg.type === 'pong') {
      this.pingMs = Math.round(performance.now() - msg.sentAt);
    }
  }

  /**
   * Broadcast local player state every frame/tick
   */
  public update(dt: number, localState: MultiplayerPlayerState): void {
    if (!this.isConnected || !this.conn || this.conn.open !== true) return;

    this.sendTimer += dt;
    if (this.sendTimer >= 0.035) { // ~30 updates per second
      this.sendTimer = 0;
      this.conn.send({
        type: 'state',
        payload: localState,
      });

      // Periodically measure ping
      if (performance.now() - this.lastPingSentTime > 2000) {
        this.lastPingSentTime = performance.now();
        this.conn.send({ type: 'ping', sentAt: this.lastPingSentTime });
      }
    }
  }

  public sendPulseFired(pos: THREE.Vector3, dir: THREE.Vector3): void {
    if (!this.isConnected || !this.conn || this.conn.open !== true) return;
    this.conn.send({
      type: 'pulse',
      pos: [pos.x, pos.y, pos.z],
      dir: [dir.x, dir.y, dir.z],
    });
  }

  public sendNetDeployed(pos: THREE.Vector3, norm: THREE.Vector3): void {
    if (!this.isConnected || !this.conn || this.conn.open !== true) return;
    this.conn.send({
      type: 'net',
      pos: [pos.x, pos.y, pos.z],
      norm: [norm.x, norm.y, norm.z],
    });
  }

  public sendDispositionShift(): void {
    if (!this.isConnected || !this.conn || this.conn.open !== true) return;
    this.conn.send({ type: 'disposition' });
  }

  public cleanup(): void {
    if (this.conn) {
      try { this.conn.close(); } catch {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    if (this.remoteCrawler) {
      this.scene.remove(this.remoteCrawler.group);
      this.remoteCrawler = null;
    }
    this.isConnected = false;
    this.role = 'none';
    this.roomCode = '';
  }
}
