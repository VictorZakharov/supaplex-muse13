import type { SessionSnapshot } from '@game/GameSession';

export class Hud {
  private readonly root: HTMLElement;
  private readonly overlay: HTMLElement;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.overlay = document.getElementById('overlay')!;
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-brand">SUPAPLEX <span>AAA REMASTERED</span></div>
        <div class="hud-stats">
          <div class="stat"><label>LEVEL</label><strong id="hud-level">1/6</strong><small id="hud-name">BOOT SECTOR</small></div>
          <div class="stat infotrons"><label>INFOTRONS</label><strong id="hud-collected">0/6</strong><div class="bar"><i id="hud-bar"></i></div></div>
          <div class="stat"><label>MOVES</label><strong id="hud-moves">0</strong></div>
          <div class="stat"><label>EXIT</label><strong id="hud-exit">LOCKED</strong></div>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="controls">Arrows/WASD move · Space grab/detonate · P pause · M mute</div>
        <div id="hud-toast" class="toast"></div>
      </div>`;
  }

  update(snapshot: SessionSnapshot): void {
    const set = (id: string, value: string): void => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    set('hud-level', `${snapshot.levelIndex + 1}/${6}`);
    set('hud-name', snapshot.levelName);
    set('hud-collected', `${snapshot.collected}/${snapshot.required}`);
    set('hud-moves', `${snapshot.moves}`);
    const exit = document.getElementById('hud-exit');
    if (exit) {
      exit.textContent = snapshot.exitOpen ? 'OPEN' : 'LOCKED';
      exit.classList.toggle('open', snapshot.exitOpen);
    }
    const bar = document.getElementById('hud-bar');
    if (bar) bar.style.width = `${Math.min(100, (snapshot.collected / Math.max(1, snapshot.required)) * 100)}%`;
  }

  toast(message: string, durationMs = 2200): void {
    const element = document.getElementById('hud-toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('visible');
    window.clearTimeout((element as unknown as { timer?: number }).timer);
    (element as unknown as { timer?: number }).timer = window.setTimeout(() => {
      element.classList.remove('visible');
    }, durationMs);
  }

  showOverlay(html: string): void {
    this.overlay.innerHTML = `<div class="panel">${html}</div>`;
    this.overlay.classList.add('visible');
  }

  hideOverlay(): void {
    this.overlay.classList.remove('visible');
    this.overlay.innerHTML = '';
  }
}
