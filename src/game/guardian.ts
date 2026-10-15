/**
 * Pitch Patrol - Central Musical Guardian
 * Cute rounded character with headphones, mic staff, and damage feedback.
 */

import * as THREE from 'three';

export class Guardian {
  public group = new THREE.Group();
  public bodyMesh!: THREE.Mesh;
  public staffMesh!: THREE.Group;
  public staffTipGlow!: THREE.PointLight;
  public bubbleShield!: THREE.Mesh;
  public leftEye!: THREE.Mesh;
  public rightEye!: THREE.Mesh;

  private targetRotationY = 0;
  private currentRotationY = 0;
  private attackAnimProgress = 1.0;
  private damageFlashProgress = 1.0;

  // Eye blinking
  private blinkTimer = 2.5;
  private isBlinking = false;
  private blinkDuration = 0.12;
  private blinkElapsed = 0;

  constructor(scene: THREE.Scene) {
    this.buildCharacter();
    this.buildBubbleShield();
    scene.add(this.group);
  }

  private buildCharacter(): void {
    // 1. Cute rounded pear-shaped body
    const bodyGeo = new THREE.SphereGeometry(1.05, 32, 32);
    bodyGeo.scale(1.0, 1.15, 0.95);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xFFFDF5,
      roughness: 0.3,
      metalness: 0.05
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 1.2;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // 2. Eyes
    const eyeGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x17213A });

    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.28, 1.38, 0.88);
    this.group.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(0.28, 1.38, 0.88);
    this.group.add(this.rightEye);

    // Blushing cheeks
    const cheekGeo = new THREE.CircleGeometry(0.1, 16);
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xFF8493,
      transparent: true,
      opacity: 0.65
    });
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.42, 1.2, 0.86);
    this.group.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.42, 1.2, 0.86);
    this.group.add(rightCheek);

    // 3. Cute Headphones
    const phoneBandGeo = new THREE.TorusGeometry(1.08, 0.08, 16, 32, Math.PI);
    const phoneBandMat = new THREE.MeshStandardMaterial({ color: 0x18233F, roughness: 0.4 });
    const phoneBand = new THREE.Mesh(phoneBandGeo, phoneBandMat);
    phoneBand.position.set(0, 1.35, 0);
    phoneBand.rotation.x = Math.PI;
    this.group.add(phoneBand);

    // Earcups (Teal #36D6C5)
    const earcupGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16);
    const earcupMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      roughness: 0.2,
      metalness: 0.3
    });

    const leftCup = new THREE.Mesh(earcupGeo, earcupMat);
    leftCup.rotation.z = Math.PI / 2;
    leftCup.position.set(-1.08, 1.38, 0);
    this.group.add(leftCup);

    const rightCup = new THREE.Mesh(earcupGeo, earcupMat);
    rightCup.rotation.z = Math.PI / 2;
    rightCup.position.set(1.08, 1.38, 0);
    this.group.add(rightCup);

    // 4. Microphone Staff
    this.staffMesh = new THREE.Group();

    const rodGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.6, 16);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xFFD36E, metalness: 0.7, roughness: 0.2 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.castShadow = true;
    this.staffMesh.add(rod);

    const headGeo = new THREE.SphereGeometry(0.22, 24, 24);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      emissive: 0x36D6C5,
      emissiveIntensity: 0.6,
      roughness: 0.1
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.88;
    this.staffMesh.add(head);

    this.staffTipGlow = new THREE.PointLight(0x36D6C5, 1.8, 8);
    this.staffTipGlow.position.set(0, 0.88, 0);
    this.staffMesh.add(this.staffTipGlow);

    this.staffMesh.position.set(0.78, 1.05, 0.42);
    this.staffMesh.rotation.z = -0.15;
    this.group.add(this.staffMesh);
  }

  private buildBubbleShield(): void {
    const bubbleGeo = new THREE.SphereGeometry(2.8, 32, 32);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.18,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.bubbleShield = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.bubbleShield.position.y = 1.2;
    this.group.add(this.bubbleShield);
  }

  public aimAt(targetPos: THREE.Vector3): void {
    this.targetRotationY = Math.atan2(targetPos.x, targetPos.z);
  }

  public triggerAttack(): void {
    this.attackAnimProgress = 0.0;
    this.staffTipGlow.intensity = 4.5;
  }

  public triggerDamageFeedback(): void {
    this.damageFlashProgress = 0.0;
  }

  public getStaffTipWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3();
    this.staffTipGlow.getWorldPosition(pos);
    return pos;
  }

  public update(time: number, dt: number, isInvulnerable = false): void {
    // Smooth rotation lerp
    let diff = this.targetRotationY - this.currentRotationY;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.currentRotationY += diff * 0.18;
    this.group.rotation.y = this.currentRotationY;

    // Idle breathing
    this.group.position.y = Math.sin(time * 3) * 0.06;

    // Natural eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkElapsed = 0;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }

    if (this.isBlinking) {
      this.blinkElapsed += dt;
      if (this.blinkElapsed < this.blinkDuration) {
        this.leftEye.scale.y = 0.1;
        this.rightEye.scale.y = 0.1;
      } else {
        this.leftEye.scale.y = 1.0;
        this.rightEye.scale.y = 1.0;
        this.isBlinking = false;
      }
    }

    // Bubble shield ripple & invulnerability pulsation
    const baseScale = isInvulnerable ? 1.0 + Math.sin(time * 18) * 0.08 : 1.0 + Math.sin(time * 2.5) * 0.02;
    this.bubbleShield.scale.set(baseScale, baseScale, baseScale);

    const shieldMat = this.bubbleShield.material as THREE.MeshStandardMaterial;
    if (isInvulnerable) {
      shieldMat.color.setHex(0xFFD36E); // Gold invulnerability glow
      shieldMat.opacity = 0.35 + Math.sin(time * 20) * 0.15;
    } else {
      shieldMat.color.setHex(0x36D6C5);
      shieldMat.opacity = 0.18;
    }

    // Damage Flash
    const bodyMat = this.bodyMesh.material as THREE.MeshStandardMaterial;
    if (this.damageFlashProgress < 1.0) {
      this.damageFlashProgress += dt * 4;
      bodyMat.color.setHex(0xFF8493); // Flash coral/red
      this.group.position.x = (Math.random() - 0.5) * 0.15;
    } else {
      bodyMat.color.setHex(0xFFFDF5);
      this.group.position.x = 0;
    }

    // Attack swing
    if (this.attackAnimProgress < 1.0) {
      this.attackAnimProgress += dt * 10;
      const swing = Math.sin(this.attackAnimProgress * Math.PI) * 0.55;
      this.staffMesh.rotation.x = swing;
      this.staffTipGlow.intensity = 1.8 + (1.0 - this.attackAnimProgress) * 3.5;
    } else {
      this.staffMesh.rotation.x = 0;
      this.staffTipGlow.intensity = 1.8;
    }
  }
}
