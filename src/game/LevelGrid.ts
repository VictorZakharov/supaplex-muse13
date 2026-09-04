import { Tile } from './Tiles';

export interface LevelSpec {
  name: string;
  required: number;
  rows: string[];
}

export const GLYPHS: Record<string, Tile> = {
  ' ': Tile.Empty,
  '.': Tile.Dirt,
  '#': Tile.Wall,
  O: Tile.Rock,
  '*': Tile.Infotron,
  X: Tile.OrangeDisk,
  Y: Tile.YellowDisk,
  '^': Tile.PortUp,
  v: Tile.PortDown,
  '<': Tile.PortLeft,
  '>': Tile.PortRight,
  '~': Tile.Electron,
  '@': Tile.Player,
  '=': Tile.Base,
  E: Tile.Exit,
};

export class LevelGrid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
  playerX = 0;
  playerY = 0;
  exitX = 0;
  exitY = 0;

  constructor(spec: LevelSpec) {
    this.height = spec.rows.length;
    this.width = Math.max(...spec.rows.map((row) => row.length));
    this.cells = new Uint8Array(this.width * this.height);
    spec.rows.forEach((row, y) => {
      for (let x = 0; x < this.width; x += 1) {
        const tile = GLYPHS[row[x] ?? ' '] ?? Tile.Empty;
        if (tile === Tile.Player) {
          this.playerX = x;
          this.playerY = y;
          this.set(x, y, Tile.Empty);
        } else if (tile === Tile.Exit) {
          this.exitX = x;
          this.exitY = y;
          this.set(x, y, Tile.Exit);
        } else {
          this.set(x, y, tile);
        }
      }
    });
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Tile {
    if (!this.inBounds(x, y)) return Tile.Wall;
    return this.cells[this.index(x, y)] as Tile;
  }

  set(x: number, y: number, tile: Tile): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.index(x, y)] = tile;
  }
}
