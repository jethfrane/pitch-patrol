/**
 * Pitch Patrol - Upgraded 3D Enemy Models & Attack Cycles
 * Features:
 * - Boundary radial separation (prevents stacking at the ring)
 * - Telegraph warning indicator
 * - isTargetedByProjectile flag for smart projectile routing
 * - Upgraded cute models (Note Sprite, Metronome Runner, Bass Blob, Chord Cloud)
 */

import * as THREE from 'three';
import { NoteBadge } from './badges';

export type EnemyType = 'note-sprite' | 'metronome-runner' | 'bass-blob' | 'chord-cloud';
export type EnemyState = 'approaching' | 'winding_up' | 'cooldown' | 'dying' | 'defeated';

export interface EnemyConfig {
  type: EnemyType;
  note: string;
  speed: number;
  spawnAngle: number;
  damage: number;
}

export class Enemy {
  public group = new THREE.Group();
  public type: EnemyType;
  public note: string;
  public speed: number;
  public damage: number;
  public badge: NoteBadge;

  public state: EnemyState = 'approaching';
  public isTargetedByProjectile = false;
  private deathProgress = 0;

  // Attack cycle timers
  public windUpDuration = 0.8;
  public attackCooldownDuration = 1.6;
  private attackTimer = 0;

  // Visual sub-meshes
  private bodyMesh!: THREE.Object3D;
  private animPart?: THREE.Object3D;
  private telegraphLight?: THREE.PointLight;
  private alertIcon?: THREE.Sprite;
  private walkCycle = 0;

  public onAttackImpact?: (enemy: Enemy, damage: number) => void;

  constructor(scene: THREE.Scene, config: EnemyConfig, startRadius: number) {
    this.type = config.type;
    this.note = config.note;
    this.speed = config.speed;
    this.damage = config.damage || 10;

    const x = Math.cos(config.spawnAngle) * startRadius;
    const z = Math.sin(config.spawnAngle) * startRadius;
    this.group.position.set(x, 0, z);

    this.buildModel();
    this.group.lookAt(0, 0, 0);

    // Upright screen-facing note badge
    this.badge = new NoteBadge(this.note);
    this.badge.sprite.position.set(0, 2.5, 0);
    this.group.add(this.badge.sprite);

    // Telegraph light
    this.telegraphLight = new THREE.PointLight(0xFF8493, 0, 5);
    this.telegraphLight.position.set(0, 1.2, 0);
    this.group.add(this.telegraphLight);

    // Exclamation alert icon for attack wind-up
    this.buildAlertIcon();

    scene.add(this.group);
  }

  private buildAlertIcon(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.font = '900 80px "Quicksand", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF5C72';
    ctx.shadowColor = '#FF8493';
    ctx.shadowBlur = 12;
    ctx.fillText('!', 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      opacity: 0
    });
    this.alertIcon = new THREE.Sprite(mat);
    this.alertIcon.scale.set(0.9, 0.9, 1);
    this.alertIcon.position.set(0, 3.4, 0);
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
    }
  }

  /**
   * 1. Note Sprite (Coral #FF8493 rounded eighth-note creature)
   */
  private buildNoteSprite(): void {
    const root = new THREE.Group();

    const headGeo = new THREE.SphereGeometry(0.7, 24, 24);
    headGeo.scale(1.15, 0.95, 0.95);
    const coralMat = new THREE.MeshStandardMaterial({
      color: 0xFF8493,
      roughness: 0.25,
      metalness: 0.1
    });
    const head = new THREE.Mesh(headGeo, coralMat);
    head.position.y = 0.7;
    head.castShadow = true;
    root.add(head);

    const stemGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 16);
    const stem = new THREE.Mesh(stemGeo, coralMat);
    stem.position.set(0.5, 1.2, 0);
    stem.castShadow = true;
    root.add(stem);

    const flagGeo = new THREE.TorusGeometry(0.32, 0.09, 16, 24, Math.PI * 0.95);
    const flag = new THREE.Mesh(flagGeo, coralMat);
    flag.position.set(0.72, 1.6, 0);
    flag.rotation.z = -Math.PI / 3;
    root.add(flag);

    const eyeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18233F });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.2, 0.82, 0.58);
    root.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.2, 0.82, 0.58);
    root.add(rightEye);

    const cheekGeo = new THREE.CircleGeometry(0.08, 16);
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xFF5C72, transparent: true, opacity: 0.7 });
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.32, 0.7, 0.62);
    root.add(leftCheek);
    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.32, 0.7, 0.62);
    root.add(rightCheek);

    this.bodyMesh = root;
    this.group.add(root);
  }

  /**
   * 2. Metronome Runner (Fast wooden metronome with swinging pendulum)
   */
  private buildMetronomeRunner(): void {
    const root = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.75, 1.3, 4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xD4A373,
      roughness: 0.5
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.y = Math.PI / 4;
    body.position.y = 0.7;
    body.castShadow = true;
    root.add(body);

    const plateGeo = new THREE.PlaneGeometry(0.42, 0.85);
    const plateMat = new THREE.MeshBasicMaterial({ color: 0xFFFDF5 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.72, 0.44);
    root.add(plate);

    const pointerGroup = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.75, 8);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xFFD36E, metalness: 0.8 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.y = 0.32;
    pointerGroup.add(rod);

    const weightGeo = new THREE.BoxGeometry(0.12, 0.1, 0.06);
    const weight = new THREE.Mesh(weightGeo, rodMat);
    weight.position.y = 0.45;
    pointerGroup.add(weight);

    pointerGroup.position.set(0, 0.38, 0.46);
    root.add(pointerGroup);
    this.animPart = pointerGroup;

    const eyeGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18233F });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0.9, 0.47);
    root.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0.9, 0.47);
    root.add(rightEye);

    this.bodyMesh = root;
    this.group.add(root);
  }

  /**
   * 3. Bass Blob (Lavender #A68CFF squishy creature with bass-clef)
   */
  private buildBassBlob(): void {
    const root = new THREE.Group();

    const domeGeo = new THREE.SphereGeometry(0.95, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.75);
    domeGeo.scale(1.25, 0.9, 1.25);
    const lavMat = new THREE.MeshStandardMaterial({
      color: 0xA68CFF,
      roughness: 0.3,
      metalness: 0.05
    });
    const dome = new THREE.Mesh(domeGeo, lavMat);
    dome.position.y = 0.7;
    dome.castShadow = true;
    root.add(dome);

    const clefCurve = new THREE.TorusGeometry(0.32, 0.08, 12, 24, Math.PI * 1.3);
    const clefMat = new THREE.MeshStandardMaterial({ color: 0x18233F, roughness: 0.2 });
    const clef = new THREE.Mesh(clefCurve, clefMat);
    clef.position.set(0, 0.75, 0.85);
    clef.rotation.z = Math.PI * 0.6;
    root.add(clef);

    const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18233F });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.35, 0.82, 0.8);
    root.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.35, 0.82, 0.8);
    root.add(rightEye);

    this.bodyMesh = root;
    this.group.add(root);
  }

  /**
   * 4. Chord Cloud (Puffy connected forms)
   */
  private buildChordCloud(): void {
    const root = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      roughness: 0.4,
      metalness: 0.1
    });

    [-0.55, 0, 0.55].forEach((offsetX, idx) => {
      const puffGeo = new THREE.SphereGeometry(0.5 + (idx === 1 ? 0.2 : 0), 16, 16);
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(offsetX, 0.75, 0);
      puff.castShadow = true;
      root.add(puff);
    });

    const eyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18233F });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.16, 0.85, 0.68);
    root.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.16, 0.85, 0.68);
    root.add(rightEye);

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

  public hit(): void {
    this.state = 'dying';
    if (this.telegraphLight) this.telegraphLight.intensity = 0;
    if (this.alertIcon) (this.alertIcon.material as THREE.SpriteMaterial).opacity = 0;
  }

  public update(dt: number, ringRadius: number): void {
    if (this.state === 'defeated') return;

    if (this.state === 'dying') {
      this.deathProgress += dt * 4.5;
      const s = Math.max(0, 1.0 - this.deathProgress);
      this.group.scale.set(s * 1.3, s * 0.7, s * 1.3);
      this.badge.sprite.scale.set(s * 2.2, s * 1.1, 1);
      if (this.deathProgress >= 1.0) {
        this.state = 'defeated';
      }
      return;
    }

    const currentDist = this.getDistanceToCenter();
    const reachedBoundary = currentDist <= (ringRadius + 0.15);

    this.group.lookAt(0, 0, 0);

    if (!reachedBoundary && this.state === 'approaching') {
      const moveDist = this.speed * dt;
      const ratio = (currentDist - moveDist) / currentDist;
      this.group.position.x *= ratio;
      this.group.position.z *= ratio;

      this.walkCycle += dt * (this.speed * 4.5);
      this.animateMovement();
    } else {
      // Engaged at boundary
      if (this.state === 'approaching') {
        this.state = 'winding_up';
        this.attackTimer = this.windUpDuration;
      }

      if (this.state === 'winding_up') {
        this.attackTimer -= dt;
        const progress = 1.0 - (this.attackTimer / this.windUpDuration);

        // Telegraph rear-back & warning light
        const rearBack = Math.sin(progress * Math.PI) * 0.4;
        this.bodyMesh.position.z = -rearBack;
        if (this.telegraphLight) {
          this.telegraphLight.intensity = progress * 4.0;
        }
        if (this.alertIcon) {
          (this.alertIcon.material as THREE.SpriteMaterial).opacity = Math.sin(progress * Math.PI);
        }

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

  private animateMovement(): void {
    switch (this.type) {
      case 'note-sprite': {
        const hop = Math.abs(Math.sin(this.walkCycle)) * 0.32;
        this.bodyMesh.position.y = hop;
        break;
      }
      case 'metronome-runner': {
        if (this.animPart) {
          this.animPart.rotation.z = Math.sin(this.walkCycle * 2.2) * 0.55;
        }
        this.bodyMesh.rotation.z = Math.sin(this.walkCycle * 1.8) * 0.12;
        break;
      }
      case 'bass-blob': {
        const squash = Math.sin(this.walkCycle) * 0.18;
        this.bodyMesh.scale.set(1.0 + squash, 1.0 - squash, 1.0 + squash);
        break;
      }
      case 'chord-cloud': {
        this.bodyMesh.position.y = Math.sin(this.walkCycle * 0.9) * 0.18;
        break;
      }
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.badge.dispose();
    if (this.alertIcon) {
      (this.alertIcon.material as THREE.Material).dispose();
    }
    scene.remove(this.group);
  }
}
