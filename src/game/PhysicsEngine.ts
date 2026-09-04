import { Config } from '@core/Config';
import { EventBus } from '@core/EventBus';
import type { GameEvents, ExplosionEvent } from './Events';
import { LevelGrid } from './LevelGrid';
import { Tile, TILE_DEFS } from './Tiles';

export interface PhysicsResult {
  playerDead: boolean;
  won: boolean;
}

export class PhysicsEngine {
  private fuse = new Map<number, { ticks: number; kind: 'orange' | 'yellow' }>();
  private falling = new Set<number>();
  private readonly bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  reset(): void {
    this.fuse.clear();
    this.falling.clear();
  }

  tryMovePlayer(grid: LevelGrid, dx: number, dy: number, state: { collected: number }): 'moved' | 'blocked' | 'ate' {
    const nx = grid.playerX + dx;
    const ny = grid.playerY + dy;
    if (!grid.inBounds(nx, ny)) return 'blocked';
    const target = grid.get(nx, ny);
    const def = TILE_DEFS[target];

    if (target === Tile.Dirt || target === Tile.Base) {
      grid.set(nx, ny, Tile.Empty);
      grid.playerX = nx;
      grid.playerY = ny;
      this.bus.emit<GameEvents['eat']>('eat', { x: nx, y: ny });
      return 'ate';
    }
    if (target === Tile.Infotron) {
      grid.set(nx, ny, Tile.Empty);
      grid.playerX = nx;
      grid.playerY = ny;
      state.collected += 1;
      this.bus.emit<GameEvents['collect']>('collect', { x: nx, y: ny, kind: 'infotron' });
      return 'moved';
    }
    if (target === Tile.Electron) {
      grid.set(nx, ny, Tile.Empty);
      grid.playerX = nx;
      grid.playerY = ny;
      this.bus.emit<GameEvents['collect']>('collect', { x: nx, y: ny, kind: 'electron' });
      return 'moved';
    }
    if (target === Tile.Exit) {
      grid.playerX = nx;
      grid.playerY = ny;
      this.bus.emit<GameEvents['exit']>('exit', { x: nx, y: ny });
      return 'moved';
    }
    if (target === Tile.Empty) {
      grid.playerX = nx;
      grid.playerY = ny;
      return 'moved';
    }
    if (target === Tile.Rock && dy === 0) {
      const bx = nx + dx;
      const by = ny;
      if (grid.inBounds(bx, by) && grid.get(bx, by) === Tile.Empty) {
        grid.set(bx, by, target);
        grid.set(nx, ny, Tile.Empty);
        grid.playerX = nx;
        grid.playerY = ny;
        this.bus.emit<GameEvents['push']>('push', { x: bx, y: by });
        return 'moved';
      }
      this.bus.emit<GameEvents['blocked']>('blocked', { x: nx, y: ny });
      return 'blocked';
    }
    if (target === Tile.OrangeDisk || target === Tile.YellowDisk) {
      if (this.tryPushDisk(grid, nx, ny, dx, dy)) return 'moved';
      this.bus.emit<GameEvents['blocked']>('blocked', { x: nx, y: ny });
      return 'blocked';
    }
    if (target === Tile.Rock) {
      this.bus.emit<GameEvents['blocked']>('blocked', { x: nx, y: ny });
      return 'blocked';
    }
    if (!def.solid) {
      grid.playerX = nx;
      grid.playerY = ny;
      return 'moved';
    }
    return 'blocked';
  }

  private tryPushDisk(grid: LevelGrid, x: number, y: number, dx: number, dy: number): boolean {
    const bx = x + dx;
    const by = y + dy;
    if (!grid.inBounds(bx, by) || grid.get(bx, by) !== Tile.Empty) return false;
    const tile = grid.get(x, y);
    grid.set(bx, by, tile);
    grid.set(x, y, Tile.Empty);
    if (tile === Tile.OrangeDisk || tile === Tile.YellowDisk) {
      this.bus.emit<GameEvents['fuse']>('fuse', {
        x: bx,
        y: by,
        color: tile === Tile.OrangeDisk ? 'orange' : 'yellow',
      });
      this.fuse.set(
        grid.index(bx, by),
        tile === Tile.OrangeDisk
          ? { ticks: Config.orangeFuseTicks, kind: 'orange' }
          : { ticks: Config.yellowFuseTicks, kind: 'yellow' },
      );
    }
    return true;
  }

  grabTile(grid: LevelGrid, dx: number, dy: number, state: { collected: number }): 'ate' | 'collected' | 'detonated' | 'none' {
    const x = grid.playerX + dx;
    const y = grid.playerY + dy;
    if (!grid.inBounds(x, y)) return 'none';
    const target = grid.get(x, y);
    if (target === Tile.Dirt || target === Tile.Base) {
      grid.set(x, y, Tile.Empty);
      this.bus.emit<GameEvents['eat']>('eat', { x, y });
      return 'ate';
    }
    if (target === Tile.Infotron) {
      grid.set(x, y, Tile.Empty);
      state.collected += 1;
      this.bus.emit<GameEvents['collect']>('collect', { x, y, kind: 'infotron' });
      return 'collected';
    }
    if (target === Tile.OrangeDisk || target === Tile.YellowDisk) {
      grid.set(x, y, Tile.Empty);
      this.bus.emit<GameEvents['fuse']>('fuse', {
        x,
        y,
        color: target === Tile.OrangeDisk ? 'orange' : 'yellow',
      });
      this.explode(grid, x, y, Config.explosionRadius, target === Tile.OrangeDisk ? 0xff6a00 : 0xffe14d, 'disk');
      return 'detonated';
    }
    return 'none';
  }

  step(grid: LevelGrid, tick: number, result: PhysicsResult): void {
    this.updateFuses(grid);
    this.applyGravity(grid, result, tick);
    if (result.playerDead || result.won) return;
    this.cyclePorts(grid, tick, result);
  }

  private updateFuses(grid: LevelGrid): void {
    const next = new Map<number, { ticks: number; kind: 'orange' | 'yellow' }>();
    for (const [key, fuse] of this.fuse) {
      const x = key % grid.width;
      const y = Math.floor(key / grid.width);
      const tile = grid.get(x, y);
      const want = fuse.kind === 'orange' ? Tile.OrangeDisk : Tile.YellowDisk;
      if (tile !== want) continue;
      const ticks = fuse.ticks - 1;
      if (ticks <= 0) {
        this.explode(grid, x, y, Config.explosionRadius, fuse.kind === 'orange' ? 0xff6a00 : 0xffe14d, 'disk');
      } else {
        next.set(key, { ...fuse, ticks });
      }
    }
    this.fuse = next;
  }

  explode(grid: LevelGrid, cx: number, cy: number, radius: number, color: number, kind: ExplosionEvent['kind']): void {
    this.bus.emit<ExplosionEvent>('explosion', { x: cx, y: cy, radius, color, kind });
    const destroyedPorts: Array<{ x: number; y: number }> = [];
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if (!grid.inBounds(x, y)) continue;
        const tile = grid.get(x, y);
        if (tile === Tile.Wall || tile === Tile.Exit) continue;
        if (tile === Tile.OrangeDisk || tile === Tile.YellowDisk) {
          if (x !== cx || y !== cy) {
            this.fuse.set(grid.index(x, y), { ticks: Config.chainFuseTicks, kind: tile === Tile.OrangeDisk ? 'orange' : 'yellow' });
          }
          continue;
        }
        if (tile === Tile.PortUp || tile === Tile.PortDown || tile === Tile.PortLeft || tile === Tile.PortRight) {
          destroyedPorts.push({ x, y });
          grid.set(x, y, Tile.Empty);
          continue;
        }
        if (tile === Tile.Base) continue;
        grid.set(x, y, Tile.Empty);
      }
    }
    for (const port of destroyedPorts) {
      this.bus.emit<ExplosionEvent>('explosion', { x: port.x, y: port.y, radius: 0, color: 0x7df9ff, kind: 'port' });
    }
  }

  private applyGravity(grid: LevelGrid, result: PhysicsResult, tick: number): void {
    const wasFalling = this.falling;
    this.falling = new Set<number>();
    for (let y = grid.height - 2; y >= 0; y -= 1) {
      const leftToRight = y % 2 === 0;
      for (let i = 0; i < grid.width; i += 1) {
        const x = leftToRight ? i : grid.width - 1 - i;
        const tile = grid.get(x, y);
        if (tile !== Tile.Rock && tile !== Tile.Infotron && tile !== Tile.OrangeDisk && tile !== Tile.YellowDisk) continue;
        if (tile === Tile.OrangeDisk || tile === Tile.YellowDisk) continue;
        const below = grid.get(x, y + 1);
        const belowIsMurphy = below === Tile.Empty && x === grid.playerX && y + 1 === grid.playerY;
        if (below === Tile.Empty && !belowIsMurphy) {
          grid.set(x, y + 1, tile);
          grid.set(x, y, Tile.Empty);
          this.falling.add(grid.index(x, y + 1));
          continue;
        }
        if (belowIsMurphy) {
          if (wasFalling.has(grid.index(x, y))) {
            grid.set(x, y + 1, tile);
            grid.set(x, y, Tile.Empty);
            result.playerDead = true;
            this.bus.emit<GameEvents['death']>('death', { x: grid.playerX, y: grid.playerY, cause: 'crushed by falling zonk' });
            return;
          }
          continue;
        }
        if (!TILE_DEFS[below].round && below !== Tile.Rock && below !== Tile.Infotron && below !== Tile.Wall) continue;
        if (below === Tile.Rock || below === Tile.Infotron || below === Tile.Wall || TILE_DEFS[below].round) {
          const dir = (x + y + tick) % 2 === 0 ? 1 : -1;
          for (const side of [dir, -dir]) {
            const sx = x + side;
            if (!grid.inBounds(sx, y) || !grid.inBounds(sx, y + 1)) continue;
            if (sx === grid.playerX && y === grid.playerY) continue;
            if (grid.get(sx, y) === Tile.Empty && grid.get(sx, y + 1) === Tile.Empty) {
              grid.set(sx, y, tile);
              grid.set(x, y, Tile.Empty);
              this.falling.add(grid.index(sx, y));
              break;
            }
          }
        }
      }
    }
  }

  private cyclePorts(grid: LevelGrid, tick: number, result: PhysicsResult): void {
    if (tick % Config.portPeriodTicks !== 0) return;
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const tile = grid.get(x, y);
        if (tile !== Tile.PortUp && tile !== Tile.PortDown && tile !== Tile.PortLeft && tile !== Tile.PortRight) continue;
        this.bus.emit<GameEvents['portCycle']>('portCycle', { x, y });
        const target = this.findPortTarget(grid, x, y);
        if (!target) continue;
        const occupant = grid.get(target.x, target.y);
        if (occupant === Tile.Rock || occupant === Tile.Infotron) {
          this.bus.emit<ExplosionEvent>('explosion', { x: target.x, y: target.y, radius: 0, color: 0x7df9ff, kind: 'port' });
          grid.set(target.x, target.y, Tile.Empty);
        } else if (target.x === grid.playerX && target.y === grid.playerY) {
          const escape = this.findEscape(grid, target.x, target.y);
          if (escape) {
            this.bus.emit<GameEvents['teleport']>('teleport', {
              fromX: grid.playerX,
              fromY: grid.playerY,
              toX: escape.x,
              toY: escape.y,
            });
            grid.playerX = escape.x;
            grid.playerY = escape.y;
          } else {
            result.playerDead = true;
            this.bus.emit<GameEvents['death']>('death', { x: grid.playerX, y: grid.playerY, cause: 'sizzled by gravity port' });
            return;
          }
        }
      }
    }
  }

  private findPortTarget(grid: LevelGrid, x: number, y: number): { x: number; y: number } | null {
    const tile = grid.get(x, y);
    const dx = tile === Tile.PortLeft ? -1 : tile === Tile.PortRight ? 1 : 0;
    const dy = tile === Tile.PortUp ? -1 : tile === Tile.PortDown ? 1 : 0;
    let cx = x + dx;
    let cy = y + dy;
    while (grid.inBounds(cx, cy)) {
      const current = grid.get(cx, cy);
      if (current === Tile.Electron || current === Tile.Wall) return { x: cx, y: cy };
      cx += dx;
      cy += dy;
    }
    return null;
  }

  private findEscape(grid: LevelGrid, x: number, y: number): { x: number; y: number } | null {
    const candidates = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    for (const candidate of candidates) {
      if (!grid.inBounds(candidate.x, candidate.y)) continue;
      const tile = grid.get(candidate.x, candidate.y);
      if (tile === Tile.Empty || tile === Tile.Dirt || tile === Tile.Base) return candidate;
    }
    return null;
  }
}
