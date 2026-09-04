import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

const MAX_PARTICLES = 2400;

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly particles: Particle[] = [];
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(MAX_PARTICLES * 3);
  private readonly colors = new Float32Array(MAX_PARTICLES * 3);
  private readonly material: THREE.PointsMaterial;

  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.geometry.setDrawRange(0, 0);
  }

  burst(x: number, y: number, color: number, count = 90, speed = 5, life = 1.1, spread = 1): void {
    const base = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.3) * Math.PI;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed * (0.3 + Math.random() * 0.9),
        Math.sin(elevation) * speed * (0.4 + Math.random() * 0.8),
        Math.sin(angle) * Math.cos(elevation) * speed * 0.7,
      );
      const jitter = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
      this.particles.push({
        position: new THREE.Vector3(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, 0.4 + Math.random() * 0.5),
        velocity,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: 0.5 + Math.random(),
        color: base.clone().lerp(jitter, 0.35),
      });
    }
  }

  trail(x: number, y: number, color: number): void {
    this.burst(x, y, color, 1, 0.5, 0.35, 0.2);
  }

  update(dt: number): void {
    const alive: Particle[] = [];
    for (const particle of this.particles) {
      particle.life -= dt;
      if (particle.life <= 0) continue;
      particle.velocity.y -= dt * 2.4;
      particle.velocity.multiplyScalar(1 - dt * 1.4);
      particle.position.addScaledVector(particle.velocity, dt);
      alive.push(particle);
    }
    this.particles.length = 0;
    this.particles.push(...alive);
    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i];
      const fade = particle.life / particle.maxLife;
      this.positions[i * 3] = particle.position.x;
      this.positions[i * 3 + 1] = particle.position.y;
      this.positions[i * 3 + 2] = particle.position.z;
      this.colors[i * 3] = particle.color.r * fade;
      this.colors[i * 3 + 1] = particle.color.g * fade;
      this.colors[i * 3 + 2] = particle.color.b * fade;
    }
    this.geometry.setDrawRange(0, this.particles.length);
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.particles.length = 0;
    this.geometry.setDrawRange(0, 0);
  }
}
