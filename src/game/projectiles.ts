/**
 * Pitch Patrol - Solid 3D Musical Soundwave Projectile
 * Glowing resonant core with soundwave arcs and particle trail.
 */

import * as THREE from 'three';
import { Enemy } from './enemies';

export class Projectile {
  public mesh: THREE.Group;
  public startPos: THREE.Vector3;
  public targetEnemy: Enemy;
  public progress = 0;
  public speed = 32; // units per second
  public isFinished = false;
  private totalDistance: number;

  constructor(scene: THREE.Scene, startPos: THREE.Vector3, targetEnemy: Enemy) {
    this.startPos = startPos.clone();
    this.targetEnemy = targetEnemy;

    const targetPos = targetEnemy.group.position.clone();
    targetPos.y = 1.0;
    this.totalDistance = Math.max(1, this.startPos.distanceTo(targetPos));

    this.mesh = new THREE.Group();

    // 1. Solid glowing 3D core (Gold #FFD36E)
    const coreGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xFFD36E,
      emissive: 0xFFD36E,
      emissiveIntensity: 0.8,
      roughness: 0.1
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    this.mesh.add(core);

    // 2. Concentric soundwave arcs (Teal #36D6C5)
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 3; i++) {
      const arcGeo = new THREE.TorusGeometry(0.5 + i * 0.28, 0.05, 12, 24, Math.PI * 1.4);
      const arc = new THREE.Mesh(arcGeo, arcMat);
      arc.position.z = -i * 0.25;
      this.mesh.add(arc);
    }

    // 3. Point light on projectile
    const light = new THREE.PointLight(0x36D6C5, 2.0, 6);
    this.mesh.add(light);

    this.mesh.position.copy(this.startPos);
    this.mesh.lookAt(targetPos);

    scene.add(this.mesh);
  }

  public update(dt: number, scene: THREE.Scene, onHit: (enemy: Enemy) => void): void {
    if (this.isFinished) return;

    this.progress += (this.speed * dt) / this.totalDistance;

    const currentTargetPos = this.targetEnemy.group.position.clone();
    currentTargetPos.y = 1.0;

    this.mesh.position.lerpVectors(this.startPos, currentTargetPos, Math.min(1.0, this.progress));
    this.mesh.lookAt(currentTargetPos);

    // Soundwave spin
    this.mesh.rotation.z += dt * 18;

    if (this.progress >= 1.0) {
      this.isFinished = true;
      this.targetEnemy.isTargetedByProjectile = false;
      scene.remove(this.mesh);
      onHit(this.targetEnemy);
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.targetEnemy.isTargetedByProjectile = false;
    scene.remove(this.mesh);
  }
}
