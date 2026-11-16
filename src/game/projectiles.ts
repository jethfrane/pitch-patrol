/**
 * Pitch Patrol - Solid 3D Musical Soundwave Projectile
 * Glowing resonant core with soundwave arcs, parabolic arc, and particle trail.
 */

import * as THREE from 'three';
import { Enemy } from './enemies';
import { ParticleSystem } from './particles';

export class Projectile {
  public mesh: THREE.Group;
  public startPos: THREE.Vector3;
  public targetEnemy: Enemy;
  public progress = 0;
  public speed = 36;
  public isFinished = false;
  public isPerfect: boolean;
  private totalDistance: number;
  private trailTimer = 0;

  constructor(scene: THREE.Scene, startPos: THREE.Vector3, targetEnemy: Enemy, isPerfect = false) {
    this.startPos = startPos.clone();
    this.targetEnemy = targetEnemy;
    this.isPerfect = isPerfect;

    const targetPos = targetEnemy.group.position.clone();
    targetPos.y = 1.05;
    this.totalDistance = Math.max(1, this.startPos.distanceTo(targetPos));

    this.mesh = new THREE.Group();

    const coreColor = isPerfect ? 0xFFF3B0 : 0xFFD36E;
    const arcColor = isPerfect ? 0xFFB703 : 0x36D6C5;

    const coreGeo = new THREE.SphereGeometry(isPerfect ? 0.48 : 0.38, 14, 14);
    const coreMat = new THREE.MeshStandardMaterial({
      color: coreColor,
      emissive: coreColor,
      emissiveIntensity: isPerfect ? 1.4 : 0.9,
      roughness: 0.1
    });
    this.mesh.add(new THREE.Mesh(coreGeo, coreMat));

    const arcMat = new THREE.MeshBasicMaterial({
      color: arcColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 3; i++) {
      const arcGeo = new THREE.TorusGeometry(0.48 + i * 0.28, 0.055, 8, 20, Math.PI * 1.45);
      const arc = new THREE.Mesh(arcGeo, arcMat);
      arc.position.z = -i * 0.24;
      this.mesh.add(arc);
    }

    const light = new THREE.PointLight(arcColor, isPerfect ? 4.5 : 2.6, 8);
    this.mesh.add(light);

    this.mesh.position.copy(this.startPos);
    this.mesh.lookAt(targetPos);
    scene.add(this.mesh);
  }

  public update(dt: number, scene: THREE.Scene, particles: ParticleSystem | null, onHit: (enemy: Enemy, isPerfect: boolean) => void): void {
    if (this.isFinished) return;

    this.progress += (this.speed * dt) / this.totalDistance;
    const clamped = Math.min(1.0, this.progress);

    const currentTargetPos = this.targetEnemy.group.position.clone();
    currentTargetPos.y = 1.05;

    this.mesh.position.lerpVectors(this.startPos, currentTargetPos, clamped);
    this.mesh.position.y += Math.sin(clamped * Math.PI) * 1.25;
    this.mesh.lookAt(currentTargetPos);
    this.mesh.rotation.z += dt * 20;

    this.trailTimer += dt;
    if (particles && this.trailTimer >= 0.028) {
      this.trailTimer = 0;
      particles.spawnTrailSpark(this.mesh.position, this.isPerfect ? 0xFFD36E : 0x36D6C5);
    }

    if (this.progress >= 1.0) {
      this.isFinished = true;
      this.targetEnemy.isTargetedByProjectile = false;
      this.destroy(scene);
      onHit(this.targetEnemy, this.isPerfect);
    }
  }

  public destroy(scene: THREE.Scene): void {
    this.targetEnemy.isTargetedByProjectile = false;
    scene.remove(this.mesh);
    this.mesh.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
  }
}
