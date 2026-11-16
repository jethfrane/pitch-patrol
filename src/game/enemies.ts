/**
 * Pitch Patrol - 3D Musical Creatures, Multi-HP Armor, Knockback & Hit Flash
 */

import * as THREE from 'three';
import { NoteBadge } from './badges';
import { disposeObject3D } from './dispose';

export type EnemyType = 'note-sprite' | 'metronome-runner' | 'bass-blob' | 'chord-cloud' | 'maestro-boss';
export type EnemyState = 'approaching' | 'winding_up' | 'cooldown' | 'dying' | 'defeated';

export interface EnemyConfig {
  type: EnemyType;
  note: string;
  speed: number;
  spawnAngle: number;
  damage: number;
  hp?: number;
}

export class Enemy {
  public group = new THREE.Group();
  public type: EnemyType;
  public note: string;
  public speed: number;
  public damage: number;
  public hp: number;
  public maxHp: number;
  public badge: NoteBadge;

  public state: EnemyState = 'approaching';
  public isTargetedByProjectile = false;
  private deathProgress = 0;

  // Knockback & hit flash physics
  private knockbackVel = 0;
  private stunTimer = 0;
  private hitFlashTimer = 0;
  private readonly maxRadius: number;
  private flashMaterials: THREE.MeshStandardMaterial[] = [];
  private baseEmissives: THREE.Color[] = [];
  private baseEmissiveIntensities: number[] = [];

  // Attack cycle timers
  public windUpDuration = 0.85;
  public attackCooldownDuration = 1.6;
  private attackTimer = 0;

  // Visual sub-meshes
  private bodyMesh!: THREE.Object3D;
  private animPart?: THREE.Object3D;
  private armorShell?: THREE.Mesh;
  private groundRing!: THREE.Mesh;
  private telegraphLight?: THREE.PointLight;
  private alertIcon?: THREE.Sprite;
  private walkCycle = 0;
  private baseScale = 1.25;

  public onAttackImpact?: (enemy: Enemy, damage: number) => void;

  constructor(scene: THREE.Scene, config: EnemyConfig, startRadius: number) {
    this.type = config.type;
    this.note = config.note;
    this.speed = config.speed;
    this.damage = config.damage || 10;
    this.maxHp = Math.max(1, config.hp ?? 1);
    this.hp = this.maxHp;
    this.maxRadius = startRadius;
    this.baseScale = this.type === 'maestro-boss' ? 1.55 : 1.25;

    const x = Math.cos(config.spawnAngle) * startRadius;
    const z = Math.sin(config.spawnAngle) * startRadius;
    this.group.position.set(x, 0, z);

    this.buildGroundRing();
    this.buildModel();
    this.cacheFlashMaterials();
    this.group.lookAt(0, 0, 0);

    // Sleek elevated badge that does not obscure the 3D character
    this.badge = new NoteBadge(this.note, this.maxHp);
    const badgeY = this.type === 'maestro-boss' ? 3.65 : 2.95;
    this.badge.sprite.position.set(0, badgeY, 0);
    this.group.add(this.badge.sprite);
    this.group.scale.setScalar(this.baseScale);

    // Telegraph point light on attack wind-up
    this.telegraphLight = new THREE.PointLight(0xFF5C72, 0, 5.5);
    this.telegraphLight.position.set(0, 1.3, 0);
    this.group.add(this.telegraphLight);

    this.buildAlertIcon(badgeY + 0.85);

    scene.add(this.group);
  }

  private buildGroundRing(): void {
    const ringGeo = new THREE.RingGeometry(0.88, 1.15, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.groundRing = new THREE.Mesh(ringGeo, ringMat);
    this.groundRing.rotation.x = -Math.PI / 2;
    this.groundRing.position.y = 0.04;
    this.group.add(this.groundRing);
  }

  private cacheFlashMaterials(): void {
    this.bodyMesh.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        if (!this.flashMaterials.includes(obj.material)) {
          this.flashMaterials.push(obj.material);
          this.baseEmissives.push(obj.material.emissive.clone());
          this.baseEmissiveIntensities.push(obj.material.emissiveIntensity);
        }
      }
    });
  }

  private buildAlertIcon(yPos: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.font = '900 84px "Quicksand", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText('!', 64, 64);
    ctx.fillStyle = '#FF3E5B';
    ctx.fillText('!', 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      opacity: 0
    });
    this.alertIcon = new THREE.Sprite(mat);
    this.alertIcon.scale.set(0.95, 0.95, 1);
    this.alertIcon.position.set(0, yPos, 0);
    this.group.add(this.alertIcon);
  }

  private buildModel(): void {
    switch (this.type) {
      case 'note-sprite':
        this.buildNoteSprite();
        break;
      case 'metronome-runner':
        this.buildMetronomeRunner();
        break;
      case 'bass-blob':
        this.buildBassBlob();
        break;
      case 'chord-cloud':
        this.buildChordCloud();
        break;
      case 'maestro-boss':
        this.buildMaestroBoss();
        break;
    }
  }

  private addEyesAndCheeks(root: THREE.Group, eyeOffsetX: number, eyeY: number, z: number, eyeRadius = 0.08): void {
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x17213A });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-eyeOffsetX, eyeY, z);
    root.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(eyeOffsetX, eyeY, z);
    root.add(rightEye);

    // Tiny white eye shine
    const shineGeo = new THREE.SphereGeometry(eyeRadius * 0.36, 8, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const leftShine = new THREE.Mesh(shineGeo, shineMat);
    leftShine.position.set(-eyeOffsetX + eyeRadius * 0.25, eyeY + eyeRadius * 0.25, z + eyeRadius * 0.8);
    root.add(leftShine);
    const rightShine = new THREE.Mesh(shineGeo, shineMat);
    rightShine.position.set(eyeOffsetX + eyeRadius * 0.25, eyeY + eyeRadius * 0.25, z + eyeRadius * 0.8);
    root.add(rightShine);
  }

  private buildNoteSprite(): void {
    const root = new THREE.Group();
    const coralMat = new THREE.MeshStandardMaterial({ color: 0xFF7A8F, roughness: 0.26, metalness: 0.08 });

    const headGeo = new THREE.SphereGeometry(0.72, 18, 16);
    headGeo.scale(1.16, 0.95, 0.96);
    const head = new THREE.Mesh(headGeo, coralMat);
    head.position.y = 0.72;
    head.castShadow = true;
    root.add(head);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.05, 12), coralMat);
    stem.position.set(0.52, 1.24, 0);
    stem.castShadow = true;
    root.add(stem);

    const flag = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 10, 18, Math.PI * 0.95), coralMat);
    flag.position.set(0.74, 1.64, 0);
    flag.rotation.z = -Math.PI / 3;
    root.add(flag);

    this.addEyesAndCheeks(root, 0.21, 0.82, 0.62, 0.085);

    this.bodyMesh = root;
    this.group.add(root);
  }

  private buildMetronomeRunner(): void {
    const root = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xDF9F67, roughness: 0.42, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.78, 1.38, 4), bodyMat);
    body.rotation.y = Math.PI / 4;
    body.position.y = 0.72;
    body.castShadow = true;
    root.add(body);

    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.86), new THREE.MeshBasicMaterial({ color: 0xFFFDF5 }));
    plate.position.set(0, 0.72, 0.45);
    root.add(plate);

    const pointerGroup = new THREE.Group();
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xFFD36E, metalness: 0.75, roughness: 0.25 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.78, 8), rodMat);
    rod.position.y = 0.34;
    pointerGroup.add(rod);

    const weight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.07), rodMat);
    weight.position.y = 0.48;
    pointerGroup.add(weight);

    pointerGroup.position.set(0, 0.38, 0.47);
    root.add(pointerGroup);
    this.animPart = pointerGroup;

    this.addEyesAndCheeks(root, 0.13, 0.94, 0.48, 0.06);

    this.bodyMesh = root;
    this.group.add(root);
  }

  private buildBassBlob(): void {
    const root = new THREE.Group();
    const lavMat = new THREE.MeshStandardMaterial({ color: 0x9F7AEA, roughness: 0.28, metalness: 0.06 });

    const domeGeo = new THREE.SphereGeometry(0.95, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.78);
    domeGeo.scale(1.24, 0.92, 1.24);
    const dome = new THREE.Mesh(domeGeo, lavMat);
    dome.position.y = 0.72;
    dome.castShadow = true;
    root.add(dome);

    const clefMat = new THREE.MeshStandardMaterial({ color: 0x18233F, roughness: 0.25 });
    const clef = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.085, 10, 18, Math.PI * 1.3), clefMat);
    clef.position.set(0, 0.76, 0.88);
    clef.rotation.z = Math.PI * 0.6;
    root.add(clef);

    this.addEyesAndCheeks(root, 0.36, 0.86, 0.84, 0.085);

    if (this.maxHp > 1) {
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xD8C7FF,
        transparent: true,
        opacity: 0.34,
        roughness: 0.15,
        metalness: 0.2
      });
      this.armorShell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.26, 1), shellMat);
      this.armorShell.position.y = 0.82;
      root.add(this.armorShell);
    }

    this.bodyMesh = root;
    this.group.add(root);
  }

  private buildChordCloud(): void {
    const root = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x36D6C5, roughness: 0.35, metalness: 0.08 });

    [-0.56, 0, 0.56].forEach((offsetX, idx) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5 + (idx === 1 ? 0.22 : 0), 14, 14), cloudMat);
      puff.position.set(offsetX, 0.78, 0);
      puff.castShadow = true;
      root.add(puff);
    });

    if (this.maxHp > 1) {
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0xFFD36E,
        emissive: 0xFFD36E,
        emissiveIntensity: 0.45,
        roughness: 0.2
      });
      this.armorShell = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.065, 8, 24), haloMat);
      this.armorShell.rotation.x = Math.PI / 2;
      this.armorShell.position.y = 1.25;
      root.add(this.armorShell);
    }

    this.addEyesAndCheeks(root, 0.17, 0.88, 0.68, 0.065);

    this.bodyMesh = root;
    this.group.add(root);
  }

  private buildMaestroBoss(): void {
    const root = new THREE.Group();
    const royalMat = new THREE.MeshStandardMaterial({
      color: 0x5A4AE3,
      roughness: 0.22,
      metalness: 0.18
    });

    const core = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 18), royalMat);
    core.scale.set(1.12, 1.05, 1.12);
    core.position.y = 1.0;
    core.castShadow = true;
    root.add(core);

    // Golden Crown
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xFFD36E,
      emissive: 0xFF9F1C,
      emissiveIntensity: 0.35,
      metalness: 0.65,
      roughness: 0.2
    });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.42, 6), goldMat);
    crown.position.y = 2.05;
    root.add(crown);

    // Orbiting harmonic ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.075, 8, 28), goldMat);
    ring.rotation.x = Math.PI * 0.42;
    ring.position.y = 1.0;
    root.add(ring);
    this.animPart = ring;

    this.addEyesAndCheeks(root, 0.34, 1.15, 0.96, 0.1);

    this.bodyMesh = root;
    this.group.add(root);
  }

  public getAngle(): number {
    return Math.atan2(this.group.position.z, this.group.position.x);
  }

  public setAngle(angle: number, radius: number): void {
    this.group.position.x = Math.cos(angle) * radius;
    this.group.position.z = Math.sin(angle) * radius;
  }

  public getDistanceToCenter(): number {
    return Math.sqrt(this.group.position.x * this.group.position.x + this.group.position.z * this.group.position.z);
  }

  public getTimeToImpact(ringRadius: number): number {
    const dist = Math.max(0, this.getDistanceToCenter() - ringRadius);
    return dist / this.speed;
  }

  public setTargetVisual(isUrgent: boolean, isMatchingPitch: boolean): void {
    this.badge.setTargeted(isUrgent);
    this.badge.setMatching(isMatchingPitch);

    const ringMat = this.groundRing.material as THREE.MeshBasicMaterial;
    if (isMatchingPitch) {
      ringMat.color.setHex(0xFFD36E);
      ringMat.opacity = 0.85;
    } else if (isUrgent) {
      ringMat.color.setHex(0x36D6C5);
      ringMat.opacity = 0.65;
    } else {
      ringMat.opacity = 0.0;
    }
  }

  public applyKnockback(force: number, flash = true): void {
    if (this.state === 'dying' || this.state === 'defeated') return;
    this.knockbackVel = Math.max(this.knockbackVel, force);
    this.stunTimer = Math.max(this.stunTimer, 0.25);
    if (flash) this.hitFlashTimer = 0.2;

    if (this.state === 'winding_up') {
      this.state = 'approaching';
      this.bodyMesh.position.z = 0;
      if (this.telegraphLight) this.telegraphLight.intensity = 0;
      if (this.alertIcon) (this.alertIcon.material as THREE.SpriteMaterial).opacity = 0;
    }
  }

  /**
   * Returns true if the hit defeated this creature (hp <= 0), false if armor absorbed / knocked back.
   */
  public hit(knockbackForce = 7.5): boolean {
    if (this.state === 'dying' || this.state === 'defeated') return false;

    this.hp = Math.max(0, this.hp - 1);
    this.badge.setHp(this.hp, this.maxHp);
    this.hitFlashTimer = 0.24;

    if (this.hp <= 0) {
      this.state = 'dying';
      if (this.telegraphLight) this.telegraphLight.intensity = 0;
      if (this.alertIcon) (this.alertIcon.material as THREE.SpriteMaterial).opacity = 0;
      (this.groundRing.material as THREE.MeshBasicMaterial).opacity = 0;
      return true;
    }

    // Survived with knockback + armor crack!
    if (this.armorShell && this.hp === 1) {
      this.armorShell.visible = false;
    }
    this.applyKnockback(knockbackForce, true);
    return false;
  }

  public update(dt: number, ringRadius: number): void {
    if (this.state === 'defeated') return;

    // White/Gold hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
      const t = this.hitFlashTimer / 0.24;
      this.flashMaterials.forEach((mat, i) => {
        mat.emissive.setHex(0xFFFFFF);
        mat.emissiveIntensity = 1.6 * t + this.baseEmissiveIntensities[i] * (1 - t);
      });
    } else {
      this.flashMaterials.forEach((mat, i) => {
        mat.emissive.copy(this.baseEmissives[i]);
        mat.emissiveIntensity = this.baseEmissiveIntensities[i];
      });
    }

    if (this.state === 'dying') {
      this.deathProgress += dt * 4.8;
      const s = Math.max(0, 1.0 - this.deathProgress);
      this.group.scale.set(s * this.baseScale * 1.25, s * this.baseScale * 0.6, s * this.baseScale * 1.25);
      this.group.rotation.y += dt * 14;
      this.badge.sprite.scale.set(s * 3.5, s * 1.95, 1);
      if (this.deathProgress >= 1.0) {
        this.state = 'defeated';
      }
      return;
    }

    // Radial knockback slide with friction
    if (this.knockbackVel > 0.05) {
      const currentDist = Math.max(0.01, this.getDistanceToCenter());
      const nextDist = Math.min(this.maxRadius - 0.5, currentDist + this.knockbackVel * dt);
      const ratio = nextDist / currentDist;
      this.group.position.x *= ratio;
      this.group.position.z *= ratio;
      this.knockbackVel *= Math.exp(-7.5 * dt);
    } else {
      this.knockbackVel = 0;
    }

    const currentDist = this.getDistanceToCenter();
    const reachedBoundary = currentDist <= (ringRadius + 0.25);

    this.group.lookAt(0, 0, 0);

    // Subtle ground ring pulse
    const ringMat = this.groundRing.material as THREE.MeshBasicMaterial;
    if (ringMat.opacity > 0.05) {
      const pulse = 1.0 + Math.sin(performance.now() * 0.009) * 0.1;
      this.groundRing.scale.setScalar(pulse);
    }

    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return;
    }

    if (!reachedBoundary && (this.state === 'approaching' || this.state === 'cooldown')) {
      this.state = 'approaching';
      const moveDist = this.speed * dt;
      const ratio = Math.max(0.01, (currentDist - moveDist) / currentDist);
      this.group.position.x *= ratio;
      this.group.position.z *= ratio;

      this.walkCycle += dt * (this.speed * 4.5);
      this.animateMovement(dt);
    } else {
      if (this.state === 'approaching') {
        this.state = 'winding_up';
        this.attackTimer = this.windUpDuration;
      }

      if (this.state === 'winding_up') {
        this.attackTimer -= dt;
        const progress = Math.min(1, Math.max(0, 1.0 - (this.attackTimer / this.windUpDuration)));
        const rearBack = Math.sin(progress * Math.PI) * 0.45;
        this.bodyMesh.position.z = -rearBack;
        if (this.telegraphLight) this.telegraphLight.intensity = progress * 5.0;
        if (this.alertIcon) (this.alertIcon.material as THREE.SpriteMaterial).opacity = Math.sin(progress * Math.PI);

        if (this.attackTimer <= 0) {
          this.state = 'cooldown';
          this.attackTimer = this.attackCooldownDuration;
          if (this.telegraphLight) this.telegraphLight.intensity = 0;
          if (this.alertIcon) (this.alertIcon.material as THREE.SpriteMaterial).opacity = 0;
          this.bodyMesh.position.z = 0;

          if (this.onAttackImpact) {
            this.onAttackImpact(this, this.damage);
          }
        }
      } else if (this.state === 'cooldown') {
        this.attackTimer -= dt;
        this.bodyMesh.position.y = Math.sin(performance.now() * 0.005) * 0.08;
        if (this.attackTimer <= 0) {
          this.state = 'winding_up';
          this.attackTimer = this.windUpDuration;
        }
      }
    }
  }

  private animateMovement(dt: number): void {
    switch (this.type) {
      case 'note-sprite':
        this.bodyMesh.position.y = Math.abs(Math.sin(this.walkCycle)) * 0.34;
        break;
      case 'metronome-runner':
        if (this.animPart) this.animPart.rotation.z = Math.sin(this.walkCycle * 2.2) * 0.6;
        this.bodyMesh.rotation.z = Math.sin(this.walkCycle * 1.8) * 0.14;
        break;
      case 'bass-blob': {
        const squash = Math.sin(this.walkCycle) * 0.16;
        this.bodyMesh.scale.set(1.0 + squash, 1.0 - squash, 1.0 + squash);
        break;
      }
      case 'chord-cloud':
        this.bodyMesh.position.y = Math.sin(this.walkCycle * 0.9) * 0.2;
        if (this.armorShell) this.armorShell.rotation.z += dt * 1.8;
        break;
      case 'maestro-boss':
        this.bodyMesh.position.y = Math.sin(this.walkCycle * 0.8) * 0.24;
        if (this.animPart) {
          this.animPart.rotation.z += dt * 2.4;
          this.animPart.rotation.y += dt * 1.6;
        }
        break;
    }
  }

  public destroy(scene: THREE.Scene): void {
    scene.remove(this.group);
    disposeObject3D(this.group);
  }
}
