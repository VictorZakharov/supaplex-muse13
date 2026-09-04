export interface DirectionInput {
  dx: number;
  dy: number;
}

const KEYMAP: Record<string, DirectionInput> = {
  ArrowUp: { dx: 0, dy: -1 },
  KeyW: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  KeyS: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  KeyA: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
};

export class InputManager {
  private readonly pressed = new Set<string>();
  private buffered: DirectionInput | null = null;
  private actionQueued = false;
  private actionHeld = false;
  private readonly actionListeners = new Set<() => void>();
  private readonly pauseListeners = new Set<() => void>();
  private readonly anyKeyListeners = new Set<() => void>();
  private facing: DirectionInput = { dx: 0, dy: 1 };

  attach(target: Window = window): void {
    target.addEventListener('keydown', (event) => {
      if (event.repeat) {
        if (KEYMAP[event.code]) event.preventDefault();
        return;
      }
      this.notifyAnyKey();
      const dir = KEYMAP[event.code];
      if (dir) {
        event.preventDefault();
        this.pressed.add(event.code);
        this.buffered = dir;
        this.facing = dir;
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        this.actionQueued = true;
        this.actionHeld = true;
        for (const listener of this.actionListeners) listener();
      }
      if (event.code === 'KeyP' || event.code === 'Escape') {
        for (const listener of this.pauseListeners) listener();
      }
    });
    target.addEventListener('keyup', (event) => {
      this.pressed.delete(event.code);
      if (event.code === 'Space') this.actionHeld = false;
    });
    target.addEventListener('blur', () => {
      this.pressed.clear();
      this.buffered = null;
      this.actionHeld = false;
    });
  }

  onAction(listener: () => void): void {
    this.actionListeners.add(listener);
  }

  onPause(listener: () => void): void {
    this.pauseListeners.add(listener);
  }

  onAnyKey(listener: () => void): void {
    this.anyKeyListeners.add(listener);
  }

  private notifyAnyKey(): void {
    for (const listener of this.anyKeyListeners) listener();
  }

  consumeDirection(): DirectionInput | null {
    if (this.buffered) {
      const dir = this.buffered;
      this.buffered = null;
      return dir;
    }
    for (const code of this.pressed) {
      const dir = KEYMAP[code];
      if (dir) return dir;
    }
    return null;
  }

  consumeAction(): boolean {
    const queued = this.actionQueued;
    this.actionQueued = false;
    return queued;
  }

  isActionHeld(): boolean {
    return this.actionHeld;
  }

  getFacing(): DirectionInput {
    return this.facing;
  }
}
