/**
 * Pitch Patrol - Central Musical Guardian
 * Expressive 3D hero with headphones, glowing charge staff, combo/nova aura, and recoil animations.
 */

import * as THREE from 'three';

export class Guardian {
  public group = new THREE.Group();
  public bodyMesh!: THREE.Mesh;
  public staffMesh!: THREE.Group;
  public staffTipOrb!: THREE.Mesh;
  public staffTipGlow!: THREE.PointLight;
  public bubbleShield!: THREE.Mesh;
  public novaHalo!: THREE.Mesh;
  public leftEye!: THREE.Mesh;
  public rightEye!: THREE.Mesh;

  private targetRotationY = 0;
  private currentRotationY = 0;
  private attackAnimProgress = 1.0;
  private novaAnimProgress = 1.0;
  private damageFlashProgress = 1.0;
  private chargeProgress = 0;
  private isNovaReady = false;

  private blinkTimer = 2.5;
  private isBlinking = false;
  private blinkDuration = 0.12;
  private blinkElapsed = 0;

  constructor(scene: THREE.Scene) {
    this.buildCharacter();
    this.buildBubbleShield();
    this.buildNovaHalo();
    scene.add(this.group);
  }

  private buildCharacter(): void {
    const bodyGeo = new THREE.SphereGeometry(1.05, 24, 24);
    bodyGeo.scale(1.0, 1.15, 0.95);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xFFFDF5,
      roughness: 0.28,
      metalness: 0.05
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 1.2;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    // Eyes with bright catchlights
    const eyeGeo = new THREE.SphereGeometry(0.115, 14, 14);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x17213A });

    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.28, 1.38, 0.88);
    this.group.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(0.28, 1.38, 0.88);
    this.group.add(this.rightEye);

    const shineGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const leftShine = new THREE.Mesh(shineGeo, shineMat);
    leftShine.position.set(-0.25, 1.41, 0.97);
    this.group.add(leftShine);
    const rightShine = new THREE.Mesh(shineGeo, shineMat);
    rightShine.position.set(0.31, 1.41, 0.97);
    this.group.add(rightShine);

    // Cute Smile
    const smileGeo = new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI * 0.75);
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x17213A });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(0, 1.22, 0.93);
    smile.rotation.z = Math.PI * 1.12;
    this.group.add(smile);

    // Blushing cheeks
    const cheekGeo = new THREE.CircleGeometry(0.11, 14);
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xFF8493,
      transparent: true,
      opacity: 0.7
    });
    const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
    leftCheek.position.set(-0.44, 1.22, 0.87);
    this.group.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMat);
    rightCheek.position.set(0.44, 1.22, 0.87);
    this.group.add(rightCheek);

    // Headphones
    const phoneBandGeo = new THREE.TorusGeometry(1.08, 0.085, 12, 28, Math.PI);
    const phoneBandMat = new THREE.MeshStandardMaterial({ color: 0x18233F, roughness: 0.35 });
    const phoneBand = new THREE.Mesh(phoneBandGeo, phoneBandMat);
    phoneBand.position.set(0, 1.35, 0);
    phoneBand.rotation.x = Math.PI;
    this.group.add(phoneBand);

    const earcupGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16);
    const earcupMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      emissive: 0x36D6C5,
      emissiveIntensity: 0.18,
      roughness: 0.2,
      metalness: 0.25
    });

    const leftCup = new THREE.Mesh(earcupGeo, earcupMat);
    leftCup.rotation.z = Math.PI / 2;
    leftCup.position.set(-1.08, 1.38, 0);
    this.group.add(leftCup);

    const rightCup = new THREE.Mesh(earcupGeo, earcupMat);
    rightCup.rotation.z = Math.PI / 2;
    rightCup.position.set(1.08, 1.38, 0);
    this.group.add(rightCup);

    // Microphone Staff
    this.staffMesh = new THREE.Group();
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xFFD36E, metalness: 0.72, roughness: 0.2 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.68, 14), rodMat);
    rod.castShadow = true;
    this.staffMesh.add(rod);

    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      emissive: 0x36D6C5,
      emissiveIntensity: 0.85,
      roughness: 0.1
    });
    this.staffTipOrb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 18), orbMat);
    this.staffTipOrb.position.y = 0.92;
    this.staffMesh.add(this.staffTipOrb);

    this.staffTipGlow = new THREE.PointLight(0x36D6C5, 2.2, 9);
    this.staffTipGlow.position.set(0, 0.92, 0);
    this.staffMesh.add(this.staffTipGlow);

    this.staffMesh.position.set(0.8, 1.05, 0.44);
    this.staffMesh.rotation.z = -0.15;
    this.group.add(this.staffMesh);
  }

  private buildBubbleShield(): void {
    const bubbleGeo = new THREE.SphereGeometry(2.6, 28, 24);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.08,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.FrontSide,
      depthWrite: false
    });
    this.bubbleShield = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.bubbleShield.position.y = 1.2;
    this.group.add(this.bubbleShield);
  }

  private buildNovaHalo(): void {
    const haloGeo = new THREE.TorusGeometry(2.15, 0.06, 10, 36);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xFFD36E,
      transparent: true,
      opacity: 0
    });
    this.novaHalo = new THREE.Mesh(haloGeo, haloMat);
    this.novaHalo.rotation.x = Math.PI / 2;
    this.novaHalo.position.y = 0.25;
    this.group.add(this.novaHalo);
  }

  public aimAt(targetPos: THREE.Vector3): void {
    this.targetRotationY = Math.atan2(targetPos.x, targetPos.z);
  }

  public setChargeState(progress: number, isNovaReady: boolean): void {
    this.chargeProgress = Math.max(0, Math.min(1, progress));
    this.isNovaReady = isNovaReady;
  }

  public triggerAttack(): void {
    this.attackAnimProgress = 0.0;
    this.staffTipGlow.intensity = 5.5;
  }

  public triggerNovaAnim(): void {
    this.novaAnimProgress = 0.0;
    this.staffTipGlow.intensity = 9.0;
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
    let diff = this.targetRotationY - this.currentRotationY;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.currentRotationY += diff * Math.min(1, dt * 11);
    this.group.rotation.y = this.currentRotationY;

    // Nova jump slam or idle breathing
    let baseY = Math.sin(time * 3) * 0.06;
    if (this.novaAnimProgress < 1.0) {
      this.novaAnimProgress += dt * 2.6;
      baseY += Math.sin(Math.min(1, this.novaAnimProgress) * Math.PI) * 1.4;
    }
    this.group.position.y = baseY;

    // Eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      this.blinkElapsed = 0;
      this.blinkTimer = 2.4 + Math.random() * 3.2;
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

    // Bubble shield pulse
    const baseScale = isInvulnerable ? 1.0 + Math.sin(time * 18) * 0.09 : 1.0 + Math.sin(time * 2.5) * 0.025;
    this.bubbleShield.scale.setScalar(baseScale);

    const shieldMat = this.bubbleShield.material as THREE.MeshStandardMaterial;
    if (isInvulnerable) {
      shieldMat.color.setHex(0xFFD36E);
      shieldMat.opacity = 0.26 + Math.sin(time * 20) * 0.12;
    } else {
      shieldMat.color.setHex(0x36D6C5);
      shieldMat.opacity = 0.08 + this.chargeProgress * 0.06;
    }

    // Nova ready golden halo
    const haloMat = this.novaHalo.material as THREE.MeshBasicMaterial;
    if (this.isNovaReady) {
      haloMat.opacity = 0.65 + Math.sin(time * 8) * 0.25;
      this.novaHalo.rotation.z = time * 1.6;
      this.novaHalo.scale.setScalar(1.0 + Math.sin(time * 6) * 0.06);
    } else {
      haloMat.opacity = 0;
    }

    // Damage flash
    const bodyMat = this.bodyMesh.material as THREE.MeshStandardMaterial;
    if (this.damageFlashProgress < 1.0) {
      this.damageFlashProgress += dt * 4;
      bodyMat.color.setHex(0xFF8493);
      bodyMat.emissive.setHex(0xFF3E5B);
      bodyMat.emissiveIntensity = (1 - this.damageFlashProgress) * 0.7;
      this.group.position.x = (Math.random() - 0.5) * 0.16;
    } else {
      bodyMat.color.setHex(0xFFFDF5);
      bodyMat.emissive.setHex(0x000000);
      bodyMat.emissiveIntensity = 0;
      this.group.position.x = 0;
    }

    // Staff charge + attack swing
    const orbMat = this.staffTipOrb.material as THREE.MeshStandardMaterial;
    const chargeScale = 1.0 + this.chargeProgress * 0.55;
    this.staffTipOrb.scale.setScalar(chargeScale);
    if (this.chargeProgress > 0.15) {
      orbMat.color.setHex(0xFFD36E);
      orbMat.emissive.setHex(0xFFD36E);
    } else {
      orbMat.color.setHex(0x36D6C5);
      orbMat.emissive.setHex(0x36D6C5);
    }

    if (this.attackAnimProgress < 1.0) {
      this.attackAnimProgress += dt * 9.5;
      const swing = Math.sin(Math.min(1, this.attackAnimProgress) * Math.PI) * 0.55;
      this.staffMesh.rotation.x = swing;
      this.staffTipGlow.intensity = 2.2 + (1.0 - this.attackAnimProgress) * 4.5;
    } else {
      this.staffMesh.rotation.x = -this.chargeProgress * 0.22;
      this.staffTipGlow.intensity = 2.2 + this.chargeProgress * 3.0;
    }
  }
}
