import * as THREE from 'three';

/**
 * Release GPU resources owned by an object hierarchy.
 * Sprite geometry is shared by Three.js, so only sprite materials are disposed.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    if (object instanceof THREE.Sprite) {
      materials.add(object.material);
      return;
    }

    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => materials.add(material));
    }
  });

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) value.dispose();
    }
    material.dispose();
  }

  for (const geometry of geometries) {
    geometry.dispose();
  }
}
