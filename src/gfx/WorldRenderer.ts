import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Config } from '@core/Config';
import type { LevelGrid } from '@game/LevelGrid';
import { Tile } from '@game/Tiles';
import { BackgroundDome } from './BackgroundDome';
import { LightingRig } from './LightingRig';
import { MaterialFactory } from './MaterialFactory';
import { ParticleSystem } from './ParticleSystem';
import { TileMeshBuilder } from './TileMeshBuilder';

interface Shockwave {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private readonly materials = new MaterialFactory();
  private readonly builder: TileMeshBuilder;
  private readonly lights = new LightingRig();
  private readonly background = new BackgroundDome();
  private readonly particles = new ParticleSystem();
  private readonly tileLayer = new THREE.Group();
  private readonly fxLayer = new THREE.Group();
  private readonly tileMeshes = new Map<number, { tile: Tile; node: THREE.Object3D }>();
  private readonly shockwaves: Shockwave[] = [];
  private murphy: THREE.Group;
  private murphyTarget = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private voidPlane: THREE.Mesh;
  private faceAngle = Math.PI;
  private lastGrid: LevelGrid | null = null;
  private lastDt = 0.016;
  private shake = 0;
  private elapsed = 0;
  private facing = { dx: 0, dy: 1 };
  private exitOpenCache = false;
  private flashLight: THREE.PointLight;
  private flashLife = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = null;
    this.camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 220);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    this.builder = new TileMeshBuilder(this.materials);
    this.murphy = this.builder.buildMurphy();
    this.flashLight = new THREE.PointLight(0xffffff, 0, 30, 1.4);
    this.voidPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: true }),
    );
    this.voidPlane.position.z = -2;
    this.background.group.visible = false;
    this.scene.add(this.background.group, this.lights.group, this.voidPlane, this.tileLayer, this.fxLayer, this.particles.points, this.murphy, this.flashLight);
    try {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.32, 0.7, 0.55);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloom = bloom;
    } catch {
      // Fallback to raw rendering if post-processing is unavailable.
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    const viewHeight = Config.cameraViewHeight;
    const halfH = viewHeight / 2;
    const halfW = halfH * (width / height);
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(width, height);
  }

  loadLevel(grid: LevelGrid, exitOpen: boolean): void {
    for (const entry of this.tileMeshes.values()) {
      this.tileLayer.remove(entry.node);
    }
    this.tileMeshes.clear();
    this.particles.clear();
    this.shockwaves.length = 0;
    this.exitOpenCache = exitOpen;
    this.faceAngle = 0;
    this.facing = { dx: 0, dy: 1 };
    this.murphy.position.set(grid.playerX, -grid.playerY, 0.5);
    this.murphy.rotation.set(0, 0, 0);
    this.murphyTarget.copy(this.murphy.position);
    this.cameraTarget.set(grid.playerX, -grid.playerY, 0);
    this.voidPlane.position.x = grid.width / 2;
    this.voidPlane.position.y = -grid.height / 2;
    this.syncTiles(grid, exitOpen, true);
  }

  setFacing(dx: number, dy: number): void {
    if (dx !== 0 || dy !== 0) {
      this.facing = { dx, dy };
      this.faceAngle = Math.atan2(-dy, dx) - Math.PI / 2;
    }
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  explosion(x: number, y: number, radius: number, color: number): void {
    const wy = -y;
    this.particles.burst(x, wy, color, 110 + radius * 60, 6.5, 1.25, 1 + radius);
    this.particles.burst(x, wy, 0xffffff, 30, 3, 0.6, 0.6);
    this.spawnShockwave(x, wy, radius, color);
    this.flashLight.position.set(x, wy, 2.5);
    this.flashLight.color.set(color);
    this.flashLight.intensity = 18;
    this.flashLife = 1;
    this.addShake(0.35 + radius * 0.25);
  }

  collectSparkle(x: number, y: number, color: number): void {
    this.particles.burst(x, -y, color, 34, 2.6, 0.8, 0.5);
  }

  teleportSparkle(x: number, y: number): void {
    this.particles.burst(x, -y, 0x7df9ff, 60, 4, 0.9, 0.8);
    this.spawnShockwave(x, -y, 1, 0x7df9ff);
  }

  dirtPuff(x: number, y: number): void {
    this.particles.burst(x, -y, 0x8a5a2b, 10, 1.4, 0.5, 0.4);
  }

  private spawnShockwave(x: number, y: number, radius: number, color: number): void {
    const geometry = new THREE.RingGeometry(0.2, 0.55, 48);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0.7);
    this.fxLayer.add(mesh);
    this.shockwaves.push({ mesh, life: 0.55 + radius * 0.15, maxLife: 0.55 + radius * 0.15 });
  }

  update(dt: number, grid: LevelGrid, playerX: number, playerY: number, exitOpen: boolean): void {
    this.elapsed += dt;
    this.lastDt = dt;
    this.lastGrid = grid;
    this.syncTiles(grid, exitOpen, false);
    this.murphyTarget.set(playerX, -playerY, 0.5);
    const k = Math.min(1, dt * Config.meshLerp);
    this.murphy.position.lerp(this.murphyTarget, k);
    const bob = Math.sin(this.elapsed * 6) * 0.05;
    this.murphy.position.z = 0.5 + bob;
    let delta = this.faceAngle - this.murphy.rotation.z;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.murphy.rotation.z += delta * Math.min(1, dt * 18);
    this.murphy.rotation.x = 0;
    this.murphy.rotation.y = 0;
    const halo = this.murphy.userData.halo as THREE.Mesh;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(this.elapsed * 5) * 0.25;
    const arrow = this.murphy.userData.arrow as THREE.Mesh | undefined;
    if (arrow) {
      (arrow.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(this.elapsed * 6) * 0.25;
      const stretch = 1 + Math.sin(this.elapsed * 6) * 0.08;
      arrow.scale.set(1, stretch, 1);
    }
    const body = this.murphy.userData.body as THREE.Mesh;
    body.scale.setScalar(1 + Math.sin(this.elapsed * 7) * 0.02);

    if (Math.random() < dt * 8) {
      this.particles.trail(this.murphy.position.x, this.murphy.position.y, 0xff2d55);
    }

    this.cameraTarget.lerp(new THREE.Vector3(playerX, -playerY, 0), Math.min(1, dt * Config.cameraLerp));
    const shakeDecay = Math.max(0, this.shake - dt * 2.2);
    this.shake = shakeDecay;
    const sx = (Math.random() - 0.5) * this.shake * 0.7;
    const sy = (Math.random() - 0.5) * this.shake * 0.7;
    this.camera.position.set(this.cameraTarget.x + sx, this.cameraTarget.y + sy, 10);
    this.camera.lookAt(this.cameraTarget.x + sx * 0.5, this.cameraTarget.y, 0);

    this.lights.followPlayer(this.murphy.position.x, this.murphy.position.y);
    this.lights.update(dt);
    this.background.update(dt);
    this.particles.update(dt);

    if (this.flashLife > 0) {
      this.flashLife -= dt * 3;
      this.flashLight.intensity = Math.max(0, this.flashLife) * 18;
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const wave = this.shockwaves[i];
      wave.life -= dt;
      const t = 1 - wave.life / wave.maxLife;
      wave.mesh.scale.setScalar(1 + t * 7);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - t));
      if (wave.life <= 0) {
        this.fxLayer.remove(wave.mesh);
        wave.mesh.geometry.dispose();
        (wave.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    if (this.bloom) {
      this.bloom.strength = 0.3 + Math.sin(this.elapsed * 1.7) * 0.03 + this.flashLife * 0.25;
    }
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private syncTiles(grid: LevelGrid, exitOpen: boolean, force: boolean): void {
    const exitChanged = exitOpen !== this.exitOpenCache;
    if (exitChanged) this.exitOpenCache = exitOpen;
    const seen = new Set<number>();
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const tile = grid.get(x, y);
        if (tile === Tile.Empty) continue;
        const key = grid.index(x, y);
        seen.add(key);
        const existing = this.tileMeshes.get(key);
        if (existing && existing.tile === tile && !(tile === Tile.Exit && exitChanged)) continue;
        if (existing) {
          this.tileLayer.remove(existing.node);
          this.tileMeshes.delete(key);
          continue;
        }
        const moved = this.adoptNeighbor(key, tile, x, y);
        if (!moved) {
          const node = this.builder.build(tile, exitOpen);
          if (!node) continue;
          node.position.set(x, -y, 0);
          this.tileLayer.add(node);
          this.tileMeshes.set(key, { tile, node });
        }
      }
    }
    for (const [key, entry] of this.tileMeshes) {
      if (!seen.has(key)) {
        this.tileLayer.remove(entry.node);
        this.tileMeshes.delete(key);
      }
    }
    for (const [key, entry] of this.tileMeshes) {
      const tx = key % grid.width;
      const ty = Math.floor(key / grid.width);
      const lerp = entry.tile === Tile.Rock || entry.tile === Tile.Infotron ? Config.tileLerp : 1000;
      const f = Math.min(1, this.lastDt * lerp);
      entry.node.position.x += (tx - entry.node.position.x) * f;
      entry.node.position.y += (-ty - entry.node.position.y) * f;
      entry.node.position.z = 0;
    }
    for (const entry of this.tileMeshes.values()) {
      const node = entry.node;
      if (entry.tile === Tile.Infotron || entry.tile === Tile.Electron) {
        node.rotation.y = this.elapsed * 1.6 + node.position.x * 0.4;
      } else if (entry.tile === Tile.OrangeDisk || entry.tile === Tile.YellowDisk) {
        node.rotation.z = this.elapsed * 2.2;
      }
    }
  }

  private adoptNeighbor(key: number, tile: Tile, x: number, y: number): boolean {
    if (tile !== Tile.Rock && tile !== Tile.Infotron) return false;
    const grid = this.lastGrid;
    if (!grid) return false;
    const candidates = [
      grid.index(x, y - 1),
      grid.index(x - 1, y),
      grid.index(x + 1, y),
      grid.index(x, y + 1),
    ];
    for (const candidate of candidates) {
      const entry = this.tileMeshes.get(candidate);
      if (entry && entry.tile === tile) {
        this.tileMeshes.delete(candidate);
        this.tileMeshes.set(key, entry);
        return true;
      }
    }
    return false;
  }
}
