import * as THREE from 'three';

export class BackgroundDome {
  readonly group = new THREE.Group();
  private readonly stars: THREE.Points;
  private readonly nebula: THREE.Mesh;
  private readonly grid: THREE.GridHelper;
  private elapsed = 0;

  constructor() {
    const starGeometry = new THREE.BufferGeometry();
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0x7df9ff), new THREE.Color(0xff7bd5), new THREE.Color(0xffffff), new THREE.Color(0x8a7bff)];
    for (let i = 0; i < count; i += 1) {
      const radius = 40 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) - 10;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 20;
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false }),
    );

    const nebulaGeometry = new THREE.PlaneGeometry(220, 120);
    const nebulaMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x2b0a4a) },
        uColorB: { value: new THREE.Color(0x062a3a) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p * vec2(1.4, 1.0));
          float waves = sin(vUv.x * 12.0 + uTime * 0.4) * sin(vUv.y * 9.0 - uTime * 0.3);
          vec3 color = mix(uColorA, uColorB, smoothstep(0.0, 0.8, d + waves * 0.08));
          float glow = smoothstep(0.75, 0.1, d);
          gl_FragColor = vec4(color + glow * 0.35, 0.95);
        }
      `,
    });
    this.nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    this.nebula.position.set(0, 18, -38);

    this.grid = new THREE.GridHelper(140, 70, 0x274bff, 0x123);
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.LineBasicMaterial).opacity = 0.16;
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = -1.6;

    const fog = new THREE.FogExp2(0x05060f, 0.012);
    this.group.add(this.stars, this.nebula, this.grid);
    this.group.userData.fog = fog;
  }

  getFog(): THREE.FogExp2 {
    return this.group.userData.fog as THREE.FogExp2;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.stars.rotation.y = this.elapsed * 0.008;
    (this.nebula.material as THREE.ShaderMaterial).uniforms.uTime.value = this.elapsed;
    this.grid.position.x = Math.sin(this.elapsed * 0.05) * 2;
  }
}
