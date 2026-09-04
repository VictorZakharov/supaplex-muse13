import { EventBus } from '@core/EventBus';
import { Logger } from '@core/Logger';
import type { DirectionInput } from '@core/InputManager';
import type { GameEvents } from './Events';
import { LEVELS } from './Levels';
import { LevelGrid, type LevelSpec } from './LevelGrid';
import { PhysicsEngine, type PhysicsResult } from './PhysicsEngine';
import { Tile } from './Tiles';

export type SessionPhase = 'ready' | 'playing' | 'dead' | 'won' | 'levelComplete' | 'gameComplete' | 'paused';

export interface SessionSnapshot {
  levelIndex: number;
  levelName: string;
  collected: number;
  required: number;
  moves: number;
  tick: number;
  playerX: number;
  playerY: number;
  exitOpen: boolean;
  phase: SessionPhase;
  causeOfDeath: string | null;
}

export class GameSession {
  readonly bus = new EventBus();
  private readonly physics = new PhysicsEngine(this.bus);
  private grid!: LevelGrid;
  private spec: LevelSpec = LEVELS[0];
  private levelIndex = 0;
  private collected = 0;
  private required = 0;
  private moves = 0;
  private tick = 0;
  private acc = 0;
  private phase: SessionPhase = 'ready';
  private pausedFrom: SessionPhase = 'playing';
  private causeOfDeath: string | null = null;
  private exitOpen = false;
  private exitAnnounced = false;
  private lastGrabDir: DirectionInput | null = null;
  private readonly result: PhysicsResult = { playerDead: false, won: false };

  constructor() {
    this.bus.on<GameEvents['death']>('death', (event) => {
      if (this.phase !== 'playing') return;
      this.phase = 'dead';
      this.causeOfDeath = event.cause;
    });
    this.bus.on<GameEvents['exit']>('exit', () => {
      if (this.phase !== 'playing') return;
      if (this.exitOpen) {
        this.result.won = true;
        this.phase = 'levelComplete';
        this.bus.emit<GameEvents['win']>('win', { level: this.levelIndex, collected: this.collected });
      } else {
        this.bus.emit<GameEvents['blocked']>('blocked', { x: this.grid.playerX, y: this.grid.playerY });
      }
    });
  }

  get levelCount(): number {
    return LEVELS.length;
  }

  loadLevel(index: number): void {
    this.levelIndex = Math.max(0, Math.min(index, LEVELS.length - 1));
    this.spec = LEVELS[this.levelIndex];
    this.grid = new LevelGrid(this.spec);
    this.physics.reset();
    this.collected = 0;
    this.required = this.spec.required;
    this.moves = 0;
    this.tick = 0;
    this.acc = 0;
    this.phase = 'ready';
    this.causeOfDeath = null;
    this.exitOpen = false;
    this.exitAnnounced = false;
    this.result.playerDead = false;
    this.result.won = false;
    Logger.info(`Loaded level ${this.levelIndex + 1}: ${this.spec.name}`);
  }

  start(): void {
    if (this.phase === 'ready' || this.phase === 'paused') {
      this.phase = 'playing';
    }
  }

  pause(): void {
    if (this.phase === 'playing') {
      this.pausedFrom = 'playing';
      this.phase = 'paused';
    }
  }

  resume(): void {
    if (this.phase === 'paused') {
      this.phase = this.pausedFrom;
    }
  }

  togglePause(): void {
    if (this.phase === 'paused') this.resume();
    else this.pause();
  }

  applyPlayerIntent(dir: DirectionInput | null, grab: boolean): void {
    if (this.phase !== 'playing') return;
    if (grab) {
      const facing = dir ?? this.lastGrabDir ?? { dx: 0, dy: 1 };
      if (dir) this.lastGrabDir = dir;
      const carry = { collected: this.collected };
      const outcome = this.physics.grabTile(this.grid, facing.dx, facing.dy, carry);
      this.collected = carry.collected;
      if (outcome !== 'none') {
        this.moves += 1;
        if (outcome === 'collected') this.checkExit();
      }
      return;
    }
    this.lastGrabDir = null;
    if (!dir) return;
    const before = this.collected;
    const carry = { collected: this.collected };
    const outcome = this.physics.tryMovePlayer(this.grid, dir.dx, dir.dy, carry);
    this.collected = carry.collected;
    if (outcome !== 'blocked') {
      this.moves += 1;
    }
    if (this.collected !== before) this.checkExit();
  }

  collectInfotron(): void {
    this.collected += 1;
    this.checkExit();
  }

  private checkExit(): void {
    if (!this.exitAnnounced && this.collected >= this.required) {
      this.exitOpen = true;
      this.exitAnnounced = true;
      this.bus.emit<GameEvents['exitOpen']>('exitOpen', { x: this.grid.exitX, y: this.grid.exitY });
    }
  }

  update(dtSeconds: number, tickRate: number): void {
    if (this.phase !== 'playing') return;
    this.acc += dtSeconds;
    const step = 1 / tickRate;
    let guard = 0;
    while (this.acc >= step && guard < 4) {
      this.acc -= step;
      guard += 1;
      this.tick += 1;
      this.physics.step(this.grid, this.tick, this.result);
      if (this.result.playerDead) {
        this.phase = 'dead';
        if (!this.causeOfDeath) this.causeOfDeath = 'mishap in the caves';
        break;
      }
      if (this.result.won) {
        this.phase = 'levelComplete';
        break;
      }
    }
  }

  advanceLevel(): boolean {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.phase = 'gameComplete';
      return false;
    }
    this.loadLevel(this.levelIndex + 1);
    this.phase = 'playing';
    return true;
  }

  retry(): void {
    const index = this.levelIndex;
    this.loadLevel(index);
    this.phase = 'playing';
  }

  snapshot(): SessionSnapshot {
    return {
      levelIndex: this.levelIndex,
      levelName: this.spec.name,
      collected: this.collected,
      required: this.required,
      moves: this.moves,
      tick: this.tick,
      playerX: this.grid.playerX,
      playerY: this.grid.playerY,
      exitOpen: this.exitOpen,
      phase: this.phase,
      causeOfDeath: this.causeOfDeath,
    };
  }

  getGrid(): LevelGrid {
    return this.grid;
  }

  getTile(x: number, y: number): Tile {
    return this.grid.get(x, y);
  }

  getPhase(): SessionPhase {
    return this.phase;
  }
}
