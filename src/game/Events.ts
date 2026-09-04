export interface ExplosionEvent {
  x: number;
  y: number;
  radius: number;
  color: number;
  kind: 'disk' | 'chain' | 'rock' | 'port';
}

export interface GameEvents {
  explosion: ExplosionEvent;
  collect: { x: number; y: number; kind: 'infotron' | 'electron' };
  eat: { x: number; y: number };
  push: { x: number; y: number };
  blocked: { x: number; y: number };
  exitOpen: { x: number; y: number };
  exit: { x: number; y: number };
  death: { x: number; y: number; cause: string };
  teleport: { fromX: number; fromY: number; toX: number; toY: number };
  fuse: { x: number; y: number; color: 'orange' | 'yellow' };
  portCycle: { x: number; y: number };
  win: { level: number; collected: number };
}
