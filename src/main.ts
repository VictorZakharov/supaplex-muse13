import { Game } from '@game/Game';
import { Logger } from '@core/Logger';

function boot(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    Logger.error('Canvas element #game-canvas not found');
    return;
  }
  new Game(canvas);
  Logger.info('Supaplex AAA Remastered initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
