import * as THREE from 'three';
import { TextureFactory } from './TextureFactory';

export interface NeonOptions {
  color: number;
  emissive: number;
  intensity?: number;
  roughness?: number;
  metalness?: number;
  mapName?: string;
  map?: THREE.Texture;
}

export class MaterialFactory {
  private readonly cache = new Map<string, THREE.Material>();
  private readonly textures = new TextureFactory();

  neon(options: NeonOptions): THREE.MeshStandardMaterial {
    const key = `neon:${options.color}:${options.emissive}:${options.intensity ?? 1}:${options.mapName ?? 'flat'}`;
    const cached = this.cache.get(key);
    if (cached) return cached as THREE.MeshStandardMaterial;
    const material = new THREE.MeshStandardMaterial({
      color: options.color,
      emissive: options.emissive,
      emissiveIntensity: options.intensity ?? 1.0,
      roughness: options.roughness ?? 0.32,
      metalness: options.metalness ?? 0.65,
    });
    if (options.map) {
      material.map = options.map;
      material.emissiveMap = options.map;
      material.emissive = new THREE.Color(0xffffff);
      material.emissiveIntensity = Math.min(1, (options.intensity ?? 1.0) * 0.55);
      material.color = new THREE.Color(0xffffff);
    }
    this.cache.set(key, material);
    return material;
  }

  rock(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0x8a7f72, emissive: 0x2a1c10, intensity: 0.35, roughness: 0.9, metalness: 0.05, mapName: 'rock', map: this.textures.rock() });
  }

  dirt(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0x3a7a3a, emissive: 0x0d240d, intensity: 0.25, roughness: 1, metalness: 0, mapName: 'grass', map: this.textures.grass() });
  }

  wall(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0x1b2436, emissive: 0x274bff, intensity: 0.5, roughness: 0.35, metalness: 0.6, mapName: 'wall', map: this.textures.wall() });
  }

  infotron(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0x39ffb0, emissive: 0x00ff88, intensity: 1.3, roughness: 0.15, metalness: 0.4 });
  }

  orangeDisk(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0xff7a1a, emissive: 0xff4400, intensity: 1.4, roughness: 0.25, metalness: 0.5 });
  }

  yellowDisk(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0xffe14d, emissive: 0xffb300, intensity: 1.4, roughness: 0.25, metalness: 0.5 });
  }

  electron(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0x9ff3ff, emissive: 0x00e5ff, intensity: 1.1, roughness: 0.2, metalness: 0.7 });
  }

  base(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0x5a6355, emissive: 0x141a12, intensity: 0.4, roughness: 0.6, metalness: 0.4, mapName: 'slab', map: this.textures.slab() });
  }

  exit(open: boolean): THREE.MeshStandardMaterial {
    if (open) {
      return this.neon({ color: 0x7dff9a, emissive: 0x00ff55, intensity: 1.5, mapName: 'exit-open', map: this.textures.exitTile(true) });
    }
    return this.neon({ color: 0x3a3f55, emissive: 0x550000, intensity: 0.6, mapName: 'exit-closed', map: this.textures.exitTile(false) });
  }

  murphy(): THREE.MeshStandardMaterial {
    return this.neon({ color: 0xff2d55, emissive: 0xff0033, intensity: 1.1, roughness: 0.3, metalness: 0.7 });
  }

  port(direction: string): THREE.MeshStandardMaterial {
    const tints: Record<string, number> = {
      up: 0xb47bff,
      down: 0x7df9ff,
      left: 0xff7bd5,
      right: 0xffe14d,
    };
    return this.neon({ color: 0x2a2140, emissive: tints[direction] ?? 0x7df9ff, intensity: 1.2 });
  }
}
