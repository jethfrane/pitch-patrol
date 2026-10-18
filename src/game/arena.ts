/**
 * Pitch Patrol - Expanded Melody Garden 3D Arena
 * Expanded stage radius (22 units), concentric grooves, decorative clouds, and reactive shield ring.
 */

import * as THREE from 'three';

export class Arena {
  public scene: THREE.Scene;
  public stageMesh!: THREE.Mesh;
  public protectiveRingMesh!: THREE.Mesh;
  public protectiveBoundaryMesh!: THREE.LineLoop;
  public cloudsGroup = new THREE.Group();
  public speakersGroup = new THREE.Group();
  public speakerCones: THREE.Mesh[] = [];
  public floatingNotesGroup = new THREE.Group();
  private grooveMeshes: THREE.Mesh[] = [];

  // Expanded dimensions
  public readonly stageRadius = 22;
  public readonly protectiveRadius = 3.6;

  private damageFlashProgress = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildStage();
    this.buildProtectiveRing();
    this.buildClouds();
    this.buildSpeakerTowers();
    this.buildFloatingMusicalNotes();
    this.setupLighting();
  }

  private buildStage(): void {
    // 1. Expanded Floating Ivory Stage
    const stageGeo = new THREE.CylinderGeometry(this.stageRadius, this.stageRadius + 0.8, 1.4, 64);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0xEAF4FF, // Soft Ivory
      roughness: 0.35,
      metalness: 0.05
    });
    this.stageMesh = new THREE.Mesh(stageGeo, stageMat);
    this.stageMesh.position.y = -0.7;
    this.stageMesh.receiveShadow = true;
    this.scene.add(this.stageMesh);

    // Gold rim base
    const baseGeo = new THREE.CylinderGeometry(this.stageRadius + 0.8, this.stageRadius - 2.0, 1.8, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xFFD36E,
      roughness: 0.4,
      metalness: 0.2
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -2.2;
    this.scene.add(baseMesh);

    // Ethereal floating under-crystal
    const crystalGeo = new THREE.ConeGeometry(this.stageRadius - 3, 9, 8);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x18233F,
      roughness: 0.6
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.rotation.x = Math.PI;
    crystalMesh.position.y = -7.5;
    this.scene.add(crystalMesh);

    // Painted garden top: radial mint lawn with piano-key style tiles
    const size = 1024, c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(size/2, size/2, 40, size/2, size/2, size/2);
    grad.addColorStop(0, '#d9f7e8'); grad.addColorStop(0.55, '#b4e8cf'); grad.addColorStop(1, '#8fd3b4');
    g.fillStyle = grad; g.fillRect(0, 0, size, size);
    g.globalAlpha = 0.16; g.fillStyle = '#ffffff';
    const tile = 64;
    for (let y = 0; y < size; y += tile) for (let x = 0; x < size; x += tile) if (((x + y) / tile) % 2 === 0) g.fillRect(x, y, tile, tile);
    g.globalAlpha = 1; g.strokeStyle = '#fff6'; g.lineWidth = 10; g.beginPath(); g.arc(size/2, size/2, size/2 - 12, 0, Math.PI * 2); g.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const topMesh = new THREE.Mesh(new THREE.CircleGeometry(this.stageRadius, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
    topMesh.rotation.x = -Math.PI / 2; topMesh.position.y = 0.005; topMesh.receiveShadow = true;
    this.scene.add(topMesh);

    // Rim flowers and bushes (instanced, cheap)
    const flowerCount = 70;
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), flowerCount);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    const palette = [0xff8fa3, 0xffd36e, 0xb79bff, 0xffffff, 0x7fe0c8];
    for (let i = 0; i < flowerCount; i++) {
      const a = (i / flowerCount) * Math.PI * 2 + Math.sin(i * 12.9) * 0.05;
      const r = this.stageRadius - 0.9 - (i % 3) * 0.35;
      const sc = 0.8 + ((i * 37) % 10) / 14;
      m.compose(new THREE.Vector3(Math.cos(a) * r, 0.3 * sc, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
      flowers.setMatrixAt(i, m); flowers.setColorAt(i, col.setHex(palette[i % palette.length]));
    }
    flowers.castShadow = true;
    this.scene.add(flowers);

    // 2. Concentric Musical Grooves
    [6.0, 10.0, 14.0, 18.0, 21.0].forEach(r => {
      const grooveMat = new THREE.MeshBasicMaterial({
        color: 0x36D6C5,
        transparent: true,
        opacity: 0.3
      });
      const ringGeo = new THREE.RingGeometry(r - 0.1, r + 0.1, 64);
      const ringMesh = new THREE.Mesh(ringGeo, grooveMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.01;
      this.grooveMeshes.push(ringMesh);
      this.scene.add(ringMesh);
    });
  }

  private buildProtectiveRing(): void {
    // Inner glowing sanctuary disk
    const diskGeo = new THREE.CircleGeometry(this.protectiveRadius, 64);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide
    });
    this.protectiveRingMesh = new THREE.Mesh(diskGeo, diskMat);
    this.protectiveRingMesh.rotation.x = -Math.PI / 2;
    this.protectiveRingMesh.position.y = 0.02;
    this.scene.add(this.protectiveRingMesh);

    // Glowing boundary line
    const points: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(theta) * this.protectiveRadius,
        0.04,
        Math.sin(theta) * this.protectiveRadius
      ));
    }
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(points);
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x36D6C5,
      linewidth: 3,
      transparent: true,
      opacity: 0.85
    });
    this.protectiveBoundaryMesh = new THREE.LineLoop(boundaryGeo, boundaryMat);
    this.scene.add(this.protectiveBoundaryMesh);
  }

  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.85, emissive: 0xFFFFFF, emissiveIntensity: 0.45,
      metalness: 0.0
    });

    // 16 cloud puffs around the perimeter
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() * 0.15);
      const dist = this.stageRadius + 6 + Math.random() * 5;
      const cloudPuffGroup = new THREE.Group();

      const numSpheres = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numSpheres; j++) {
        const r = 1.6 + Math.random() * 2.0;
        const sphereGeo = new THREE.SphereGeometry(r, 16, 16);
        const sphereMesh = new THREE.Mesh(sphereGeo, cloudMat);
        sphereMesh.position.set(
          (j - numSpheres / 2) * 1.5,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 1.5
        );
        sphereMesh.castShadow = true;
        cloudPuffGroup.add(sphereMesh);
      }

      cloudPuffGroup.position.set(
        Math.cos(angle) * dist,
        -1.5 + Math.sin(i) * 1.5,
        Math.sin(angle) * dist
      );
      this.cloudsGroup.add(cloudPuffGroup);
    }

    this.scene.add(this.cloudsGroup);
  }

  private buildSpeakerTowers(): void {
    const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    const towerDist = this.stageRadius + 1.8;

    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xA68CFF, // Lavender
      roughness: 0.3
    });
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x18233F,
      roughness: 0.5
    });

    angles.forEach(ang => {
      const tower = new THREE.Group();

      const cabinetGeo = new THREE.CylinderGeometry(1.6, 1.9, 4.5, 16);
      const cabinet = new THREE.Mesh(cabinetGeo, towerMat);
      cabinet.castShadow = true;
      tower.add(cabinet);

      // Two bouncing speaker cones
      for (let y = -0.9; y <= 0.9; y += 1.8) {
        const coneGeo = new THREE.CylinderGeometry(0.7, 0.25, 0.5, 16);
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, y, 1.35);
        tower.add(cone);
        this.speakerCones.push(cone);
      }

      tower.position.set(
        Math.cos(ang) * towerDist,
        1.6,
        Math.sin(ang) * towerDist
      );
      tower.lookAt(0, 1.6, 0);
      this.speakersGroup.add(tower);
    });

    this.scene.add(this.speakersGroup);
  }

  private buildFloatingMusicalNotes(): void {
    const symbols = ['♪', '♫', '♩', '♬'];
    const colors = ['#FFD36E', '#A68CFF', '#36D6C5', '#FF8493'];
    const count = 10;
    const radius = this.stageRadius + 3.2;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const char = symbols[i % symbols.length];
      const color = colors[i % colors.length];

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.font = '900 84px "Quicksand", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillText(char, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.85
      });
      const sprite = new THREE.Sprite(spriteMat);
      const baseY = 2.0 + (i % 3) * 0.8;
      sprite.scale.set(1.6, 1.6, 1);
      sprite.position.set(
        Math.cos(angle) * radius,
        baseY,
        Math.sin(angle) * radius
      );
      sprite.userData = {
        baseY,
        angle,
        offset: i * 0.7
      };
      this.floatingNotesGroup.add(sprite);
    }

    this.scene.add(this.floatingNotesGroup);
  }

  private setupLighting(): void {
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x9BB8E8, 0.95);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xFFEFD0, 1.6);
    dirLight.position.set(20, 35, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 80;
    const d = 26;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x36D6C5, 0.45);
    rimLight.position.set(-20, 15, -20);
    this.scene.add(rimLight);
  }

  public triggerDamageFlash(): void {
    this.damageFlashProgress = 0.0;
  }

  public update(time: number, isThreatNear = false, dt = 0.016): void {
    // Cloud bobbing
    for (let i = 0; i < this.cloudsGroup.children.length; i++) {
      const puff = this.cloudsGroup.children[i];
      puff.position.y += Math.sin(time * 0.8 + i) * 0.002;
    }

    // Floating musical note decor bobbing and slow drift
    for (let i = 0; i < this.floatingNotesGroup.children.length; i++) {
      const note = this.floatingNotesGroup.children[i];
      const ud = note.userData;
      note.position.y = ud.baseY + Math.sin(time * 1.8 + ud.offset) * 0.35;
    }

    // Concentric grooves beat pulse
    this.grooveMeshes.forEach((mesh, idx) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.sin(time * 3 + idx * 0.6) * 0.05;
    });

    // Speaker woofers pulse
    const beatPulse = 1.0 + Math.sin(time * 6) * 0.08;
    this.speakerCones.forEach(cone => {
      cone.scale.set(beatPulse, 1, beatPulse);
    });

    const boundaryMat = this.protectiveBoundaryMesh.material as THREE.LineBasicMaterial;
    const diskMat = this.protectiveRingMesh.material as THREE.MeshBasicMaterial;

    // Damage flash reaction
    if (this.damageFlashProgress < 1.0) {
      this.damageFlashProgress += dt * 3.5;
      boundaryMat.color.setHex(0xFF8493); // Flash coral/red
      diskMat.color.setHex(0xFF8493);
      diskMat.opacity = 0.4 * (1.0 - this.damageFlashProgress);
    } else if (isThreatNear) {
      const flash = (Math.sin(time * 12) + 1) * 0.5;
      boundaryMat.color.setHex(flash > 0.5 ? 0xFF8493 : 0xFFD36E);
      diskMat.color.setHex(0xFF8493);
      diskMat.opacity = 0.22 + flash * 0.12;
    } else {
      boundaryMat.color.setHex(0x36D6C5);
      diskMat.color.setHex(0x36D6C5);
      diskMat.opacity = 0.14 + Math.sin(time * 2) * 0.03;
    }
  }
}
