/**
 * Pitch Patrol - Confetti & Score Popup Particle Effects
 */

import * as THREE from 'three';

interface ConfettiBit {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ScorePopup {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  pos: THREE.Vector3;
  life: number;
}

const PALETTE = [0x36D6C5, 0xA68CFF, 0xFF8493, 0xFFD36E, 0xFFFFFF];

export class ParticleSystem {
  public scene: THREE.Scene;
  private confettiBits: ConfettiBit[] = [];
  private scorePopups: ScorePopup[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public burstConfetti(origin: THREE.Vector3, count = 25): void {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.04);

    for (let i = 0; i < count; i++) {
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.copy(origin);
      mesh.position.y += 0.5;

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 4.5;
      const up = 2.0 + Math.random() * 4.0;

      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        up,
        Math.sin(angle) * speed
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      this.scene.add(mesh);

      this.confettiBits.push({
        mesh,
        velocity,
        rotSpeed,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4
      });
    }
  }

  public showScorePopup(origin: THREE.Vector3, text: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.font = '900 42px "Quicksand", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Gold / In-tune glow
    ctx.shadowColor = '#FFD36E';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFD36E';
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.0, 1.0, 1);
    const pos = origin.clone();
    pos.y += 2.2;
    sprite.position.copy(pos);

    this.scene.add(sprite);

    this.scorePopups.push({
      sprite,
      texture,
      pos,
      life: 0
    });
  }

  public update(dt: number): void {
    // 1. Update Confetti
    for (let i = this.confettiBits.length - 1; i >= 0; i--) {
      const bit = this.confettiBits[i];
      bit.life += dt;

      // Gravity
      bit.velocity.y -= 9.8 * dt;

      bit.mesh.position.addScaledVector(bit.velocity, dt);
      bit.mesh.rotation.x += bit.rotSpeed.x * dt;
      bit.mesh.rotation.y += bit.rotSpeed.y * dt;
      bit.mesh.rotation.z += bit.rotSpeed.z * dt;

      // Shrink towards end
      const scale = Math.max(0, 1.0 - bit.life / bit.maxLife);
      bit.mesh.scale.set(scale, scale, scale);

      if (bit.life >= bit.maxLife) {
        this.scene.remove(bit.mesh);
        (bit.mesh.material as THREE.Material).dispose();
        this.confettiBits.splice(i, 1);
      }
    }

    // 2. Update Score Popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.life += dt;
      popup.pos.y += dt * 1.5;
      popup.sprite.position.copy(popup.pos);

      const opacity = Math.max(0, 1.0 - popup.life / 0.9);
      (popup.sprite.material as THREE.SpriteMaterial).opacity = opacity;

      if (popup.life >= 0.9) {
        this.scene.remove(popup.sprite);
        popup.texture.dispose();
        (popup.sprite.material as THREE.Material).dispose();
        this.scorePopups.splice(i, 1);
      }
    }
  }
}
