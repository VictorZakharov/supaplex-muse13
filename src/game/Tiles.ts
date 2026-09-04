export enum Tile {
  Empty = 0,
  Dirt = 1,
  Wall = 2,
  Rock = 3,
  Infotron = 4,
  OrangeDisk = 5,
  PortUp = 6,
  PortDown = 7,
  PortLeft = 8,
  PortRight = 9,
  Electron = 10,
  Player = 11,
  Base = 12,
  Exit = 13,
  YellowDisk = 14,
}

export interface TileDef {
  solid: boolean;
  heavy: boolean;
  round: boolean;
  explosive: boolean;
  edible: boolean;
  name: string;
}

export const TILE_DEFS: Record<Tile, TileDef> = {
  [Tile.Empty]: { solid: false, heavy: false, round: false, explosive: false, edible: false, name: 'Void' },
  [Tile.Dirt]: { solid: false, heavy: false, round: false, explosive: false, edible: true, name: 'Dirt' },
  [Tile.Wall]: { solid: true, heavy: false, round: false, explosive: false, edible: false, name: 'Wall' },
  [Tile.Rock]: { solid: false, heavy: true, round: true, explosive: false, edible: false, name: 'Zonk' },
  [Tile.Infotron]: { solid: false, heavy: true, round: true, explosive: false, edible: false, name: 'Infotron' },
  [Tile.OrangeDisk]: { solid: false, heavy: true, round: false, explosive: true, edible: false, name: 'OrangeDisk' },
  [Tile.PortUp]: { solid: true, heavy: false, round: false, explosive: false, edible: false, name: 'PortUp' },
  [Tile.PortDown]: { solid: true, heavy: false, round: false, explosive: false, edible: false, name: 'PortDown' },
  [Tile.PortLeft]: { solid: true, heavy: false, round: false, explosive: false, edible: false, name: 'PortLeft' },
  [Tile.PortRight]: { solid: true, heavy: false, round: false, explosive: false, edible: false, name: 'PortRight' },
  [Tile.Electron]: { solid: true, heavy: false, round: false, explosive: false, edible: false, name: 'Electron' },
  [Tile.Player]: { solid: false, heavy: false, round: false, explosive: false, edible: false, name: 'Murphy' },
  [Tile.Base]: { solid: false, heavy: false, round: false, explosive: false, edible: false, name: 'Base' },
  [Tile.Exit]: { solid: false, heavy: false, round: false, explosive: false, edible: false, name: 'Exit' },
  [Tile.YellowDisk]: { solid: false, heavy: true, round: false, explosive: true, edible: false, name: 'YellowDisk' },
};
