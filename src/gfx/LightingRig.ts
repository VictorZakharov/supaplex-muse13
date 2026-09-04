import * as THREE from 'three';

export class LightingRig {
  readonly group = new THREE.Group();
  private readonly key: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly playerLight: THREE.PointLight;
  private elapsed = 0;

  constructor() {
    this.ambient = new THREE.AmbientLight(0x445566, 0.9);
    this.hemi = new THREE.HemisphereLight(0x8ad8ff, 0x1a0f2e, 0.45);
    this.key = new THREE.DirectionalLight(0xfff2d9, 1.25);
    this.key.position.set(6, 10, 4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 60;
    this.rim = new THREE.DirectionalLight(0x7df9ff, 0.55);
    this.rim.position.set(-8, 4, -6);
    this.playerLight = new THREE.PointLight(0xff5d7e, 1.6, 12, 1.6);
    this.playerLight.position.set(0, 0, 2.2);
    this.group.add(this.ambient, this.hemi, this.key, this.rim, this.playerLight);
  }

  followPlayer(x: number, y: number): void {
    this.playerLight.position.set(x, y, 2.2);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const pulse = 0.45 + Math.sin(this.elapsed * 2.2) * 0.1;
    this.rim.intensity = pulse;
    this.playerLight.intensity = 1.5 + Math.sin(this.elapsed * 5.1) * 0.2;
  }
}
