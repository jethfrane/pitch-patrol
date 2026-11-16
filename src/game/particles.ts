/**
 * Pitch Patrol - Confetti, Impact Flashing Lights, Shockwaves & Score Popups
 */

import * as THREE from 'three';

interface ConfettiBit {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  ownsMaterial: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface FlashLight {
  light: THREE.PointLight;
  peakIntensity: number;
  life: number;
  maxLife: number;
}

interface ScorePopup {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  pos: THREE.Vector3;
  life: number;
  duration: number;
}

const PALETTE = [0x36D6C5, 0xA68CFF, 0xFF8493, 0xFFD36E, 0xFFFFFF];

export class ParticleSystem {
  public scene: THREE.Scene;
  private confettiBits: ConfettiBit[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private flashLights: FlashLight[] = [];
  private scorePopups: ScorePopup[] = [];

  private readonly confettiGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.05);
  private readonly sparkGeometry = new THREE.OctahedronGeometry(0.14, 0);
  private readonly ringGeometry = new THREE.RingGeometry(0.72, 1.0, 40);
  private readonly pooledMaterials: THREE.MeshBasicMaterial[] = PALETTE.map(
    color => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public burstConfetti(origin: THREE.Vector3, count = 22): void {
    for (let i = 0; i < count; i++) {
      const mat = this.pooledMaterials[i % this.pooledMaterials.length];
      const mesh = new THREE.Mesh(this.confettiGeometry, mat);

      mesh.position.copy(origin);
      mesh.position.y += 0.6;

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 5.2;
      const up = 2.6 + Math.random() * 4.4;

      this.scene.add(mesh);
      this.confettiBits.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, up, Math.sin(angle) * speed),
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16),
        life: 0,
        maxLife: 0.65 + Math.random() * 0.45,
        gravity: 11.5,
        ownsMaterial: false
      });
    }
  }

  public spawnHitSparks(origin: THREE.Vector3, colorHex = 0xFFD36E, count = 12): void {
    const colorIndex = PALETTE.indexOf(colorHex);
    const sharedMat = colorIndex >= 0 ? this.pooledMaterials[colorIndex] : null;
    for (let i = 0; i < count; i++) {
      const mat = sharedMat ?? new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(this.sparkGeometry, mat);
      mesh.position.copy(origin);
      mesh.position.y = Math.max(0.5, origin.y + 0.5);

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 5.5 + Math.random() * 5.0;

      this.scene.add(mesh);
      this.confettiBits.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 1.5 + Math.random() * 2.5, Math.sin(angle) * speed),
        rotSpeed: new THREE.Vector3(10, 12, 8),
        life: 0,
        maxLife: 0.38 + Math.random() * 0.18,
        gravity: 7.0,
        ownsMaterial: sharedMat === null
      });
    }
  }

  public spawnTrailSpark(origin: THREE.Vector3, colorHex = 0x36D6C5): void {
    if (this.confettiBits.length > 160) return; // cap on mobile
    const colorIndex = PALETTE.indexOf(colorHex);
    const mat = colorIndex >= 0 ? this.pooledMaterials[colorIndex] : this.pooledMaterials[0];
    const mesh = new THREE.Mesh(this.sparkGeometry, mat);
    mesh.position.copy(origin);
    mesh.scale.setScalar(0.65);

    this.scene.add(mesh);
    this.confettiBits.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2),
      rotSpeed: new THREE.Vector3(6, 6, 6),
      life: 0,
      maxLife: 0.24,
      gravity: 1.5,
      ownsMaterial: false
    });
  }

  public spawnImpactFlash(origin: THREE.Vector3, colorHex = 0xFFD36E, maxScale = 4.2, lightIntensity = 12): void {
    // 1. Expanding ground shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(this.ringGeometry, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(origin.x, 0.08, origin.z);
    ring.scale.setScalar(0.4);
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring,
      material: ringMat,
      life: 0,
      maxLife: 0.36,
      maxScale
    });

    // 2. Dynamic flashing point light (capped to 4 concurrent lights for mobile WebGL speed)
    if (this.flashLights.length < 4) {
      const light = new THREE.PointLight(colorHex, lightIntensity, 14, 1.4);
      light.position.set(origin.x, 2.2, origin.z);
      this.scene.add(light);
      this.flashLights.push({
        light,
        peakIntensity: lightIntensity,
        life: 0,
        maxLife: 0.24
      });
    }
  }

  public spawnNovaWave(origin: THREE.Vector3): void {
    this.spawnImpactFlash(origin, 0x36D6C5, 23.0, 22);
    this.spawnImpactFlash(origin, 0xFFD36E, 17.5, 16);
    this.burstConfetti(origin, 36);
    this.spawnHitSparks(origin, 0x36D6C5, 18);
  }

  public showScorePopup(origin: THREE.Vector3, text: string, color = '#FFD36E'): void {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.font = '900 40px "Quicksand", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(23, 33, 58, 0.85)';
    ctx.strokeText(text, 160, 64);

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillText(text, 160, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      toneMapped: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.0, 1.2, 1);
    const pos = origin.clone();
    pos.y += 2.6;
    sprite.position.copy(pos);
    sprite.renderOrder = 12;

    this.scene.add(sprite);

    this.scorePopups.push({
      sprite,
      texture,
      pos,
      life: 0,
      duration: 0.95
    });
  }

  public update(dt: number): void {
    // 1. Confetti & sparks
    for (let i = this.confettiBits.length - 1; i >= 0; i--) {
      const bit = this.confettiBits[i];
      bit.life += dt;
      bit.velocity.y -= bit.gravity * dt;

      bit.mesh.position.addScaledVector(bit.velocity, dt);
      if (bit.mesh.position.y < 0.06) {
        bit.mesh.position.y = 0.06;
        bit.velocity.y *= -0.35;
        bit.velocity.x *= 0.82;
        bit.velocity.z *= 0.82;
      }
      bit.mesh.rotation.x += bit.rotSpeed.x * dt;
      bit.mesh.rotation.y += bit.rotSpeed.y * dt;
      bit.mesh.rotation.z += bit.rotSpeed.z * dt;

      const scale = Math.max(0, 1.0 - bit.life / bit.maxLife);
      bit.mesh.scale.setScalar(scale);

      if (bit.life >= bit.maxLife) {
        this.scene.remove(bit.mesh);
        if (bit.ownsMaterial) (bit.mesh.material as THREE.Material).dispose();
        this.confettiBits.splice(i, 1);
      }
    }

    // 2. Shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      const t = Math.min(1, sw.life / sw.maxLife);
      const easeOut = 1 - Math.pow(1 - t, 3);
      const scale = 0.4 + easeOut * sw.maxScale;
      sw.mesh.scale.setScalar(scale);
      sw.material.opacity = (1 - t) * 0.85;

      if (sw.life >= sw.maxLife) {
        this.scene.remove(sw.mesh);
        sw.material.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    // 3. Flashing dynamic impact lights
    for (let i = this.flashLights.length - 1; i >= 0; i--) {
      const fl = this.flashLights[i];
      fl.life += dt;
      const t = Math.min(1, fl.life / fl.maxLife);
      fl.light.intensity = fl.peakIntensity * Math.pow(1 - t, 2);

      if (fl.life >= fl.maxLife) {
        this.scene.remove(fl.light);
        this.flashLights.splice(i, 1);
      }
    }

    // 4. Score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.life += dt;
      popup.pos.y += dt * 1.8;
      popup.sprite.position.copy(popup.pos);

      const t = popup.life / popup.duration;
      (popup.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1.0 - Math.pow(t, 1.6));

      if (popup.life >= popup.duration) {
        this.scene.remove(popup.sprite);
        popup.texture.dispose();
        (popup.sprite.material as THREE.Material).dispose();
        this.scorePopups.splice(i, 1);
      }
    }
  }
}
