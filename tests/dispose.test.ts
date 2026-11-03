import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { disposeObject3D } from '../src/game/dispose.ts';
import { ParticleSystem } from '../src/game/particles.ts';

test('disposes unique enemy geometry, materials, and textures exactly once', () => {
  const group = new THREE.Group();

  const meshGeometry = new THREE.BoxGeometry(1, 1, 1);
  const meshMaterial = new THREE.MeshBasicMaterial();
  group.add(new THREE.Mesh(meshGeometry, meshMaterial));

  const sharedGeometry = new THREE.SphereGeometry(1, 4, 4);
  const sharedMaterial = new THREE.MeshStandardMaterial();
  group.add(new THREE.Mesh(sharedGeometry, sharedMaterial));
  group.add(new THREE.Mesh(sharedGeometry, sharedMaterial));

  const texture = new THREE.Texture();
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);
  group.add(sprite);

  let meshGeometryDisposals = 0;
  let meshMaterialDisposals = 0;
  let sharedGeometryDisposals = 0;
  let sharedMaterialDisposals = 0;
  let spriteMaterialDisposals = 0;
  let textureDisposals = 0;
  let spriteGeometryDisposals = 0;

  meshGeometry.addEventListener('dispose', () => meshGeometryDisposals++);
  meshMaterial.addEventListener('dispose', () => meshMaterialDisposals++);
  sharedGeometry.addEventListener('dispose', () => sharedGeometryDisposals++);
  sharedMaterial.addEventListener('dispose', () => sharedMaterialDisposals++);
  spriteMaterial.addEventListener('dispose', () => spriteMaterialDisposals++);
  texture.addEventListener('dispose', () => textureDisposals++);
  sprite.geometry.addEventListener('dispose', () => spriteGeometryDisposals++);

  disposeObject3D(group);

  assert.equal(meshGeometryDisposals, 1);
  assert.equal(meshMaterialDisposals, 1);
  assert.equal(sharedGeometryDisposals, 1);
  assert.equal(sharedMaterialDisposals, 1);
  assert.equal(spriteMaterialDisposals, 1);
  assert.equal(textureDisposals, 1);
  assert.equal(spriteGeometryDisposals, 0);
});

test('confetti bursts reuse a single geometry', () => {
  const scene = new THREE.Scene();
  const particles = new ParticleSystem(scene);

  particles.burstConfetti(new THREE.Vector3(), 3);
  particles.burstConfetti(new THREE.Vector3(), 3);

  const meshes = scene.children.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh);
  assert.equal(meshes.length, 6);
  assert.equal(new Set(meshes.map((mesh) => mesh.geometry)).size, 1);
});
