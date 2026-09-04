import * as THREE from 'three';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Painter = (ctx: CanvasRenderingContext2D, size: number, rand: () => number) => void;

export class TextureFactory {
  private readonly cache = new Map<string, THREE.CanvasTexture>();

  private make(name: string, size: number, paint: Painter, seed = 1): THREE.CanvasTexture {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    paint(ctx, size, mulberry32(seed));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(name, texture);
    return texture;
  }

  grass(): THREE.CanvasTexture {
    return this.make(
      'grass',
      256,
      (ctx, s, rand) => {
        const base = ctx.createLinearGradient(0, 0, 0, s);
        base.addColorStop(0, '#35823a');
        base.addColorStop(1, '#2a6b2d');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 30; i += 1) {
          const r = 14 + rand() * 34;
          ctx.fillStyle = rand() < 0.5 ? 'rgba(28,84,30,0.35)' : 'rgba(96,178,92,0.28)';
          ctx.beginPath();
          ctx.arc(rand() * s, rand() * s, r, 0, 7);
          ctx.fill();
        }
        for (let i = 0; i < 40; i += 1) {
          ctx.fillStyle = 'rgba(74,53,32,0.5)';
          ctx.fillRect(rand() * s, rand() * s, 3, 2);
        }
        const greens = ['#5fd35f', '#3fa34d', '#79e579', '#2b7a2b', '#a8e6a1'];
        ctx.lineCap = 'round';
        for (let i = 0; i < 750; i += 1) {
          const x = rand() * s;
          const y = rand() * s;
          const len = 4 + rand() * 6;
          const ang = -Math.PI / 2 + (rand() - 0.5) * 1.6;
          ctx.strokeStyle = greens[Math.floor(rand() * greens.length)];
          ctx.lineWidth = 1 + rand();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
          ctx.stroke();
        }
        for (let i = 0; i < 12; i += 1) {
          const x = rand() * s;
          const y = rand() * s;
          ctx.fillStyle = rand() < 0.6 ? '#ffffff' : '#ffe14d';
          for (let p = 0; p < 5; p += 1) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.6, 0, 7);
            ctx.fill();
          }
          ctx.fillStyle = '#ffcf3d';
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, 7);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(12,34,12,0.6)';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, s, s);
      },
      7,
    );
  }

  wall(): THREE.CanvasTexture {
    return this.make(
      'wall',
      256,
      (ctx, s, rand) => {
        ctx.fillStyle = '#232b1f';
        ctx.fillRect(0, 0, s, s);
        const rows = 4;
        const bh = s / rows;
        const bw = s / 2;
        for (let r = 0; r < rows; r += 1) {
          const offset = r % 2 === 0 ? 0 : bw / 2;
          for (let c = -1; c < 3; c += 1) {
            const x = c * bw + offset;
            const y = r * bh;
            const gradient = ctx.createLinearGradient(x, y, x, y + bh);
            gradient.addColorStop(0, '#7d8471');
            gradient.addColorStop(0.5, '#5d6355');
            gradient.addColorStop(1, '#454a40');
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
            ctx.fillStyle = 'rgba(220,255,220,0.14)';
            ctx.fillRect(x + 3, y + 3, bw - 6, 3);
            ctx.strokeStyle = 'rgba(20,26,18,0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 3, y + 3, bw - 6, bh - 6);
            for (let m = 0; m < 3; m += 1) {
              const mx = x + 8 + rand() * (bw - 16);
              const my = y + 8 + rand() * (bh - 16);
              const mr = 3 + rand() * 7;
              ctx.fillStyle = rand() < 0.5 ? 'rgba(63,122,52,0.75)' : 'rgba(87,160,71,0.65)';
              ctx.beginPath();
              ctx.arc(mx, my, mr, 0, 7);
              ctx.fill();
            }
          }
        }
        ctx.strokeStyle = 'rgba(46,94,40,0.9)';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let x = rand() * s;
        let y = rand() * s;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j += 1) {
          x += (rand() - 0.5) * 90;
          y += (rand() - 0.5) * 90;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#4c9a45';
        for (let l = 0; l < 8; l += 1) {
          ctx.beginPath();
          ctx.ellipse(rand() * s, rand() * s, 4, 2, rand() * 3, 0, 7);
          ctx.fill();
        }
      },
      21,
    );
  }

  rock(): THREE.CanvasTexture {
    return this.make(
      'rock',
      256,
      (ctx, s, rand) => {
        ctx.fillStyle = '#7f8578';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 36; i += 1) {
          const r = 10 + rand() * 28;
          ctx.fillStyle = rand() < 0.5 ? 'rgba(58,63,55,0.4)' : 'rgba(168,175,158,0.32)';
          ctx.beginPath();
          ctx.arc(rand() * s, rand() * s, r, 0, 7);
          ctx.fill();
        }
        for (let i = 0; i < 800; i += 1) {
          const v = rand();
          ctx.fillStyle = v < 0.5 ? '#5d6355' : v < 0.85 ? '#8d9284' : '#a8ad9c';
          ctx.fillRect(rand() * s, rand() * s, 2, 2);
        }
        ctx.strokeStyle = 'rgba(32,36,30,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          let x = rand() * s;
          let y = rand() * s;
          ctx.moveTo(x, y);
          for (let j = 0; j < 5; j += 1) {
            x += (rand() - 0.5) * 70;
            y += (rand() - 0.5) * 70;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 14; i += 1) {
          const mx = rand() * s;
          const my = rand() * s * 0.6;
          const mr = 4 + rand() * 10;
          ctx.fillStyle = rand() < 0.5 ? 'rgba(63,122,52,0.8)' : 'rgba(99,178,77,0.7)';
          ctx.beginPath();
          ctx.arc(mx, my, mr, 0, 7);
          ctx.fill();
        }
        const glow = ctx.createRadialGradient(s * 0.3, s * 0.28, 8, s * 0.3, s * 0.28, s * 0.7);
        glow.addColorStop(0, 'rgba(255,255,255,0.16)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, s, s);
      },
      33,
    );
  }

  slab(): THREE.CanvasTexture {
    return this.make(
      'slab',
      256,
      (ctx, s, rand) => {
        ctx.fillStyle = '#2c3a26';
        ctx.fillRect(0, 0, s, s);
        const half = s / 2;
        for (let px = 0; px < 2; px += 1) {
          for (let py = 0; py < 2; py += 1) {
            const x = px * half;
            const y = py * half;
            const gradient = ctx.createLinearGradient(x, y, x + half, y + half);
            gradient.addColorStop(0, '#6b7263');
            gradient.addColorStop(1, '#4e544a');
            ctx.fillStyle = gradient;
            ctx.fillRect(x + 4, y + 4, half - 8, half - 8);
            ctx.fillStyle = 'rgba(220,255,220,0.12)';
            ctx.fillRect(x + 4, y + 4, half - 8, 3);
            for (let m = 0; m < 2; m += 1) {
              ctx.fillStyle = 'rgba(63,122,52,0.8)';
              ctx.beginPath();
              ctx.arc(x + 10 + rand() * (half - 20), y + 10 + rand() * (half - 20), 3 + rand() * 5, 0, 7);
              ctx.fill();
            }
            ctx.fillStyle = '#3a4038';
            for (const [rx, ry] of [
              [x + 13, y + 13],
              [x + half - 13, y + 13],
              [x + 13, y + half - 13],
              [x + half - 13, y + half - 13],
            ]) {
              ctx.beginPath();
              ctx.arc(rx, ry, 3, 0, 7);
              ctx.fill();
            }
          }
        }
        ctx.strokeStyle = '#4c9a45';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i += 1) {
          const x = rand() * s;
          const y = rand() * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 4, y - 8);
          ctx.moveTo(x, y);
          ctx.lineTo(x + 4, y - 8);
          ctx.stroke();
        }
      },
      55,
    );
  }

  exitTile(open: boolean): THREE.CanvasTexture {
    return this.make(
      open ? 'exit-open' : 'exit-closed',
      256,
      (ctx, s, rand) => {
        ctx.fillStyle = '#0c1410';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = open ? 'rgba(0,255,102,0.8)' : 'rgba(90,110,90,0.7)';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, s - 16, s - 16);
        ctx.fillStyle = open ? '#2f9e4f' : '#3d4a3d';
        for (let i = 0; i < 10; i += 1) {
          const t = i / 10;
          const edge = i % 2 === 0;
          const lx = edge ? 14 + rand() * 10 : t * s;
          const ly = edge ? t * s : 14 + rand() * 10;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 6, 3, rand() * 3, 0, 7);
          ctx.fill();
        }
        ctx.lineWidth = 16;
        ctx.lineCap = 'square';
        if (open) {
          ctx.shadowColor = '#00ff66';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = '#37ff8b';
        } else {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#5a6a5a';
        }
        for (let i = 0; i < 3; i += 1) {
          const y = s * (0.28 + i * 0.22);
          ctx.beginPath();
          ctx.moveTo(s * 0.28, y - 22);
          ctx.lineTo(s * 0.52, y);
          ctx.lineTo(s * 0.28, y + 22);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      },
      open ? 77 : 78,
    );
  }
}
