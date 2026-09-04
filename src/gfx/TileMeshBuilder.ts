import * as THREE from 'three';
import { Tile } from '@game/Tiles';
import type { MaterialFactory } from './MaterialFactory';

export class TileMeshBuilder {
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials: MaterialFactory;

  constructor(materials: MaterialFactory) {
    this.materials = materials;
    this.geometries.set('box', new THREE.BoxGeometry(1, 1, 1));
    this.geometries.set('sphere', new THREE.SphereGeometry(0.48, 24, 18));
    this.geometries.set('disk', new THREE.CylinderGeometry(0.46, 0.46, 0.24, 28));
    this.geometries.set('orb', new THREE.OctahedronGeometry(0.46, 1));
    this.geometries.set('port', new THREE.TorusGeometry(0.36, 0.15, 14, 28));
    this.geometries.set('murphy', new THREE.SphereGeometry(0.46, 28, 22));
    this.geometries.set('exit', new THREE.BoxGeometry(1, 1, 0.3));
  }

  build(tile: Tile, exitOpen: boolean): THREE.Object3D | null {
    const group = new THREE.Group();
    const add = (geometry: string, material: THREE.Material, y = 0, z = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(this.geometries.get(geometry)!, material);
      mesh.position.set(0, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    switch (tile) {
      case Tile.Wall:
        add('box', this.materials.wall());
        break;
      case Tile.Dirt:
        add('box', this.materials.dirt());
        break;
      case Tile.Rock:
        add('sphere', this.materials.rock());
        break;
      case Tile.Infotron:
        add('orb', this.materials.infotron());
        break;
      case Tile.OrangeDisk: {
        add('disk', this.materials.orangeDisk());
        break;
      }
      case Tile.YellowDisk: {
        const mesh = add('disk', this.materials.yellowDisk(), 0.05);
        mesh.rotation.z = 0.7;
        break;
      }
      case Tile.Electron:
        add('orb', this.materials.electron());
        break;
      case Tile.Base:
        add('box', this.materials.base());
        break;
      case Tile.Exit:
        add('exit', this.materials.exit(exitOpen));
        break;
      case Tile.PortUp:
      case Tile.PortDown:
      case Tile.PortLeft:
      case Tile.PortRight: {
        const direction = tile === Tile.PortUp ? 'up' : tile === Tile.PortDown ? 'down' : tile === Tile.PortLeft ? 'left' : 'right';
        add('port', this.materials.port(direction));
        break;
      }
      default:
        return null;
    }
    return group;
  }

  buildMurphy(): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.geometries.get('murphy')!, this.materials.murphy());
    body.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x7df9ff, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.8 }),
    );
    visor.position.set(0, 0.3, 0.26);
    visor.scale.set(1.5, 0.75, 0.6);
    visor.rotation.x = -0.9;
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.42, 12),
      new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    arrow.position.set(0, 0.78, 0.12);
    arrow.rotation.x = Math.PI / 2;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.035, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    halo.rotation.x = 0;
    group.add(body, visor, arrow, halo);
    group.userData.halo = halo;
    group.userData.body = body;
    group.userData.arrow = arrow;
    group.userData.visor = visor;
    return group;
  }
}
