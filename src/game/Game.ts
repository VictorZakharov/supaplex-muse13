import { Config } from '@core/Config';
import { InputManager } from '@core/InputManager';
import { AudioEngine } from '@game/AudioEngine';
import type { GameEvents } from '@game/Events';
import { GameSession, type SessionSnapshot } from '@game/GameSession';
import { WorldRenderer } from '@gfx/WorldRenderer';
import { Hud } from '@ui/Hud';
import '@ui/styles.css';

export class Game {
  private readonly session = new GameSession();
  private readonly input = new InputManager();
  private readonly audio = new AudioEngine();
  private readonly hud = new Hud();
  private readonly renderer: WorldRenderer;
  private lastTime = performance.now();
  private lastSnapshot: SessionSnapshot | null = null;
  private moveAcc: number = Config.playerMoveInterval;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WorldRenderer(canvas);
    this.input.attach();
    this.wireEvents();
    this.session.loadLevel(0);
    this.renderer.loadLevel(this.session.getGrid(), false);
    this.hud.update(this.session.snapshot());
    this.showTitle();
    this.loop();
  }

  private wireEvents(): void {
    this.session.bus.on<GameEvents['explosion']>('explosion', (event) => {
      this.renderer.explosion(event.x, event.y, event.radius, event.color);
      this.audio.explosion();
    });
    this.session.bus.on<GameEvents['collect']>('collect', (event) => {
      this.renderer.collectSparkle(event.x, event.y, event.kind === 'infotron' ? 0x39ffb0 : 0x9ff3ff);
      this.audio.collect();
      if (event.kind === 'infotron') this.hud.toast(`INFOTRON ${this.session.snapshot().collected}/${this.session.snapshot().required}`);
    });
    this.session.bus.on<GameEvents['eat']>('eat', (event) => {
      this.renderer.dirtPuff(event.x, event.y);
      this.audio.eat();
    });
    this.session.bus.on<GameEvents['push']>('push', () => this.audio.push());
    this.session.bus.on<GameEvents['blocked']>('blocked', () => this.audio.blocked());
    this.session.bus.on<GameEvents['teleport']>('teleport', (event) => {
      this.renderer.teleportSparkle(event.toX, event.toY);
      this.audio.teleport();
      this.hud.toast('GRAVITY PORT JUMP');
    });
    this.session.bus.on<GameEvents['exitOpen']>('exitOpen', () => {
      this.audio.exitOpen();
      this.hud.toast('EXIT OPEN — GET TO THE GREEN GATE', 3000);
    });
    this.session.bus.on<GameEvents['win']>('win', () => this.audio.win());
    this.session.bus.on<GameEvents['death']>('death', (event) => {
      this.audio.death();
      this.renderer.addShake(0.8);
      this.hud.toast(`MURPHY DOWN — ${event.cause.toUpperCase()}`, 3200);
    });
    this.session.bus.on<GameEvents['fuse']>('fuse', (event) => {
      this.hud.toast(event.color === 'orange' ? 'ORANGE DISK ARMED' : 'YELLOW DISK ARMED — RUN');
    });

    this.input.onAction(() => {
      this.audio.unlock();
      const snapshot = this.session.snapshot();
      if (snapshot.phase === 'ready') {
        this.session.start();
        this.audio.startMusic();
        this.hud.hideOverlay();
        return;
      }
      if (snapshot.phase === 'dead' || snapshot.phase === 'levelComplete' || snapshot.phase === 'gameComplete') {
        this.handleOverlayAdvance();
      }
    });
    this.input.onPause(() => {
      const snapshot = this.session.snapshot();
      if (snapshot.phase === 'playing') {
        this.session.pause();
        this.hud.showOverlay(`<h1>PAUSED</h1><p>Press P to resume · Space handled by game</p>`);
      } else if (snapshot.phase === 'paused') {
        this.session.resume();
        this.hud.hideOverlay();
      }
    });
    this.input.onAnyKey(() => this.audio.unlock());
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.hud.toast(muted ? 'AUDIO MUTED' : 'AUDIO ON');
      }
      if (event.code === 'KeyR') {
        this.session.retry();
        this.renderer.loadLevel(this.session.getGrid(), false);
        this.hud.hideOverlay();
        this.hud.toast('LEVEL RESTARTED');
      }
      if (event.code === 'KeyN') {
        this.session.advanceLevel();
        this.renderer.loadLevel(this.session.getGrid(), false);
        this.hud.hideOverlay();
      }
    });
  }

  private showTitle(): void {
    this.hud.showOverlay(`
      <div class="eyebrow">ENTERPRISE EDITION · WEBPACK + THREE.JS</div>
      <h1>SUPAPLEX</h1>
      <h2>AAA REMASTERED</h2>
      <p>Eat dirt. Push zonks. Harvest infotrons. Detonate orange disks. Ride gravity ports. Six handcrafted sectors.</p>
      <div class="keys"><span>WASD / Arrows — move</span><span>Space — grab / detonate</span><span>P — pause</span><span>R — retry</span></div>
      <button id="start-btn">▶ &nbsp;INITIALIZE MURPHY</button>
    `);
    document.getElementById('start-btn')?.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.click();
      this.audio.startMusic();
      this.session.start();
      this.hud.hideOverlay();
      this.hud.toast('COLLECT INFOTRONS — FIND THE EXIT');
    });
  }

  private handleOverlayAdvance(): void {
    const snapshot = this.session.snapshot();
    if (snapshot.phase === 'dead') {
      this.session.retry();
      this.renderer.loadLevel(this.session.getGrid(), false);
      this.hud.hideOverlay();
      this.hud.toast('MURPHY REBOOTED');
    } else if (snapshot.phase === 'levelComplete') {
      const hasNext = this.session.advanceLevel();
      this.renderer.loadLevel(this.session.getGrid(), this.session.snapshot().exitOpen);
      this.hud.hideOverlay();
      if (hasNext) this.hud.toast(`SECTOR ${this.session.snapshot().levelIndex + 1}: ${this.session.snapshot().levelName}`);
    } else if (snapshot.phase === 'gameComplete') {
      this.session.loadLevel(0);
      this.session.start();
      this.renderer.loadLevel(this.session.getGrid(), false);
      this.hud.hideOverlay();
    }
  }

  private syncOverlay(snapshot: SessionSnapshot): void {
    const previous = this.lastSnapshot?.phase;
    if (previous === snapshot.phase) return;
    if (snapshot.phase === 'dead') {
      this.hud.showOverlay(`
        <div class="eyebrow">SIGNAL LOST</div>
        <h1>MURPHY DOWN</h1>
        <p>${snapshot.causeOfDeath ?? 'mishap in the caves'}</p>
        <button id="retry-btn">↻ &nbsp;REBOOT SECTOR (Space)</button>
      `);
      document.getElementById('retry-btn')?.addEventListener('click', () => this.handleOverlayAdvance());
    } else if (snapshot.phase === 'levelComplete') {
      const last = snapshot.levelIndex >= this.session.levelCount - 1;
      this.hud.showOverlay(`
        <div class="eyebrow">SECTOR CLEAR</div>
        <h1>${last ? 'ALL SECTORS CLEAR' : 'EXIT REACHED'}</h1>
        <p>${snapshot.collected} infotrons · ${snapshot.moves} moves</p>
        <button id="next-btn">${last ? 'FINISH RUN' : 'NEXT SECTOR ▶'} (Space)</button>
      `);
      document.getElementById('next-btn')?.addEventListener('click', () => this.handleOverlayAdvance());
    } else if (snapshot.phase === 'gameComplete') {
      this.hud.showOverlay(`
        <div class="eyebrow">MISSION COMPLETE</div>
        <h1>SUPAPLEX MASTER</h1>
        <p>You cleared all six sectors. Legendary.</p>
        <button id="again-btn">↻ &nbsp;RUN IT AGAIN (Space)</button>
      `);
      document.getElementById('again-btn')?.addEventListener('click', () => this.handleOverlayAdvance());
    }
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    const snapshotBefore = this.session.snapshot();
    if (snapshotBefore.phase === 'playing') {
      const dir = this.input.consumeDirection();
      this.input.consumeAction();
      const grabbing = this.input.isActionHeld();
      if (dir) this.renderer.setFacing(dir.dx, dir.dy);
      if (grabbing) {
        this.moveAcc += dt;
        if (this.moveAcc >= Config.playerMoveInterval) {
          this.moveAcc = 0;
          this.session.applyPlayerIntent(dir, true);
        }
      } else if (dir) {
        this.moveAcc += dt;
        if (this.moveAcc >= Config.playerMoveInterval) {
          this.moveAcc = 0;
          this.session.applyPlayerIntent(dir, false);
        }
      } else {
        this.moveAcc = Config.playerMoveInterval;
      }
    } else {
      this.input.consumeDirection();
      this.input.consumeAction();
    }

    this.session.update(dt, Config.tickRate);
    const snapshot = this.session.snapshot();
    this.hud.update(snapshot);
    this.syncOverlay(snapshot);
    this.lastSnapshot = snapshot;
    this.renderer.update(dt, this.session.getGrid(), snapshot.playerX, snapshot.playerY, snapshot.exitOpen);
    this.renderer.render();
  };
}
