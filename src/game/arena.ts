/**
 * Pitch Patrol - 3D Melody Garden Arena
 * Layered floating island, instanced 3D flowers, reactive amp towers, clouds, and harmonic charge beam.
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
  public speakerStrips: THREE.Mesh[] = [];
  public floatingNotesGroup = new THREE.Group();
  private ambientMotes!: THREE.Points;
  private chargeBeam!: THREE.Mesh;
  private grooveMeshes: THREE.Mesh[] = [];

  public readonly stageRadius = 22;
  public readonly protectiveRadius = 3.8;

  private damageFlashProgress = 1.0;
  private hitPulseProgress = 1.0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildStage();
    this.buildProtectiveRing();
    this.buildChargeBeam();
    this.buildClouds();
    this.buildSpeakerTowers();
    this.buildFloatingMusicalNotes();
    this.buildAmbientMotes();
    this.setupLighting();
  }

  private buildStage(): void {
    // Ivory stage disk
    const stageGeo = new THREE.CylinderGeometry(this.stageRadius, this.stageRadius + 0.85, 1.5, 64);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0xEAF4FF,
      roughness: 0.35,
      metalness: 0.06
    });
    this.stageMesh = new THREE.Mesh(stageGeo, stageMat);
    this.stageMesh.position.y = -0.75;
    this.stageMesh.receiveShadow = true;
    this.scene.add(this.stageMesh);

    // Gold beveled trim
    const baseGeo = new THREE.CylinderGeometry(this.stageRadius + 0.9, this.stageRadius - 1.8, 1.9, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xFFD36E,
      roughness: 0.35,
      metalness: 0.25
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -2.35;
    this.scene.add(baseMesh);

    // Faceted indigo floating island underside crystal
    const crystalGeo = new THREE.ConeGeometry(this.stageRadius - 2.5, 10, 10);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x1D2E54,
      roughness: 0.45,
      metalness: 0.15,
      flatShading: true
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.rotation.x = Math.PI;
    crystalMesh.position.y = -8.2;
    this.scene.add(crystalMesh);

    // Painted garden meadow top texture
    const size = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(size / 2, size / 2, 48, size / 2, size / 2, size / 2);
    grad.addColorStop(0, '#DFF9EC');
    grad.addColorStop(0.55, '#B7EAD2');
    grad.addColorStop(1, '#84CFAF');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);

    g.globalAlpha = 0.16;
    g.fillStyle = '#FFFFFF';
    const tile = 64;
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        if (((x + y) / tile) % 2 === 0) g.fillRect(x, y, tile, tile);
      }
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 14, 0, Math.PI * 2);
    g.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const topMesh = new THREE.Mesh(
      new THREE.CircleGeometry(this.stageRadius, 64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })
    );
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.y = 0.01;
    topMesh.receiveShadow = true;
    this.scene.add(topMesh);

    // Instanced 3D Rim Bushes + Flower Petals + Golden Centers (3 draw calls total)
    const flowerCount = 56;
    const bushGeo = new THREE.DodecahedronGeometry(0.42, 0);
    const blossomGeo = new THREE.CylinderGeometry(0.32, 0.18, 0.18, 5);
    const centerGeo = new THREE.SphereGeometry(0.13, 8, 8);

    const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0x62C39C, roughness: 0.75 }), flowerCount);
    const blossoms = new THREE.InstancedMesh(blossomGeo, new THREE.MeshStandardMaterial({ roughness: 0.45 }), flowerCount);
    const centers = new THREE.InstancedMesh(centerGeo, new THREE.MeshStandardMaterial({ color: 0xFFD36E, emissive: 0xFFB703, emissiveIntensity: 0.25 }), flowerCount);

    const mat4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const col = new THREE.Color();
    const palette = [0xFF8493, 0xA68CFF, 0xFFFFFF, 0xFFD36E, 0x7FE0C8];

    for (let i = 0; i < flowerCount; i++) {
      const a = (i / flowerCount) * Math.PI * 2 + Math.sin(i * 11.7) * 0.04;
      const r = this.stageRadius - 0.85 - (i % 2) * 0.35;
      const sc = 0.85 + ((i * 37) % 10) / 18;
      const fx = Math.cos(a) * r;
      const fz = Math.sin(a) * r;

      pos.set(fx, 0.22 * sc, fz);
      scale.set(sc * 1.15, sc * 0.72, sc * 1.15);
      mat4.compose(pos, quat, scale);
      bushes.setMatrixAt(i, mat4);

      pos.set(fx, 0.48 * sc, fz);
      scale.set(sc, sc, sc);
      mat4.compose(pos, quat, scale);
      blossoms.setMatrixAt(i, mat4);
      blossoms.setColorAt(i, col.setHex(palette[i % palette.length]));

      pos.set(fx, 0.56 * sc, fz);
      mat4.compose(pos, quat, scale);
      centers.setMatrixAt(i, mat4);
    }
    bushes.castShadow = true;
    blossoms.castShadow = true;
    this.scene.add(bushes, blossoms, centers);

    // Concentric musical grooves
    [6.5, 10.5, 14.5, 18.5].forEach(r => {
      const grooveMat = new THREE.MeshBasicMaterial({
        color: 0x20BFA9,
        transparent: true,
        opacity: 0.22
      });
      const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 64);
      const ringMesh = new THREE.Mesh(ringGeo, grooveMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.02;
      this.grooveMeshes.push(ringMesh);
      this.scene.add(ringMesh);
    });
  }

  private buildProtectiveRing(): void {
    const diskGeo = new THREE.CircleGeometry(this.protectiveRadius, 64);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide
    });
    this.protectiveRingMesh = new THREE.Mesh(diskGeo, diskMat);
    this.protectiveRingMesh.rotation.x = -Math.PI / 2;
    this.protectiveRingMesh.position.y = 0.03;
    this.scene.add(this.protectiveRingMesh);

    const points: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(theta) * this.protectiveRadius,
        0.05,
        Math.sin(theta) * this.protectiveRadius
      ));
    }
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(points);
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x36D6C5,
      transparent: true,
      opacity: 0.88
    });
    this.protectiveBoundaryMesh = new THREE.LineLoop(boundaryGeo, boundaryMat);
    this.scene.add(this.protectiveBoundaryMesh);
  }

  private buildChargeBeam(): void {
    const beamGeo = new THREE.CylinderGeometry(0.11, 0.22, 1, 10, 1, true);
    beamGeo.translate(0, 0.5, 0);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xFFD36E,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.chargeBeam = new THREE.Mesh(beamGeo, beamMat);
    this.chargeBeam.visible = false;
    this.scene.add(this.chargeBeam);
  }

  public updateChargeBeam(startPos: THREE.Vector3, targetPos: THREE.Vector3 | null, progress: number): void {
    const mat = this.chargeBeam.material as THREE.MeshBasicMaterial;
    if (!targetPos || progress <= 0.05) {
      this.chargeBeam.visible = false;
      mat.opacity = 0;
      return;
    }

    const end = targetPos.clone();
    end.y = 1.05;
    const dist = startPos.distanceTo(end);
    if (dist < 0.2) {
      this.chargeBeam.visible = false;
      return;
    }

    this.chargeBeam.visible = true;
    this.chargeBeam.position.copy(startPos);
    this.chargeBeam.lookAt(end);
    const thickness = 0.5 + progress * 0.9;
    this.chargeBeam.scale.set(thickness, thickness, dist);
    mat.opacity = 0.25 + progress * 0.6;
  }

  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.8,
      emissive: 0xEAF4FF,
      emissiveIntensity: 0.35,
      metalness: 0.0
    });

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + (Math.random() * 0.14);
      const dist = this.stageRadius + 7.2 + Math.random() * 5.0;
      const cloudPuffGroup = new THREE.Group();

      const numSpheres = 4 + (i % 3);
      for (let j = 0; j < numSpheres; j++) {
        const r = 1.5 + ((j * 7 + i) % 5) * 0.35;
        const sphereGeo = new THREE.SphereGeometry(r, 12, 10);
        const sphereMesh = new THREE.Mesh(sphereGeo, cloudMat);
        sphereMesh.position.set(
          (j - numSpheres / 2) * 1.45,
          ((j % 2) - 0.5) * 0.65,
          ((i + j) % 2 - 0.5) * 1.1
        );
        cloudPuffGroup.add(sphereMesh);
      }

      const baseY = -1.8 + Math.sin(i * 1.7) * 1.6;
      cloudPuffGroup.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist);
      cloudPuffGroup.userData = { baseY, angle, dist, speed: 0.015 + (i % 3) * 0.006 };
      this.cloudsGroup.add(cloudPuffGroup);
    }

    this.scene.add(this.cloudsGroup);
  }

  private buildSpeakerTowers(): void {
    const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    const towerDist = this.stageRadius + 2.0;

    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8F7CE8, roughness: 0.28, metalness: 0.12 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xFFD36E, roughness: 0.25, metalness: 0.55 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x18233F, roughness: 0.45 });

    angles.forEach(ang => {
      const tower = new THREE.Group();

      // Main cabinet
      const cabinet = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, 4.6, 8), towerMat);
      cabinet.castShadow = true;
      tower.add(cabinet);

      // Gold top crown ring
      const crown = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.11, 8, 20), trimMat);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 2.3;
      tower.add(crown);

      // Glowing teal equalizer strip
      const stripMat = new THREE.MeshStandardMaterial({
        color: 0x36D6C5,
        emissive: 0x36D6C5,
        emissiveIntensity: 0.7
      });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), stripMat);
      strip.position.set(0, 0, 1.55);
      tower.add(strip);
      this.speakerStrips.push(strip);

      // Floating glowing beacon orb above tower crown
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), stripMat);
      orb.position.set(0, 3.05, 0);
      tower.add(orb);
      this.speakerStrips.push(orb);

      // Two front-facing speaker cones with gold bezels
      for (let y = -0.85; y <= 0.85; y += 1.7) {
        const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.08, 8, 18), trimMat);
        bezel.position.set(0, y, 1.48);
        tower.add(bezel);

        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.24, 0.45, 16), coneMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, y, 1.38);
        tower.add(cone);
        this.speakerCones.push(cone);
      }

      tower.position.set(Math.cos(ang) * towerDist, 1.7, Math.sin(ang) * towerDist);
      tower.lookAt(0, 1.7, 0);
      this.speakersGroup.add(tower);
    });

    this.scene.add(this.speakersGroup);
  }

  private buildFloatingMusicalNotes(): void {
    const symbols = ['♪', '♫', '♩', '♬'];
    const colors = ['#FFD36E', '#A68CFF', '#36D6C5', '#FF8493'];
    const count = 10;
    const radius = this.stageRadius + 3.4;

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
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9 });
      const sprite = new THREE.Sprite(spriteMat);
      const baseY = 2.4 + (i % 3) * 0.9;
      sprite.scale.set(1.75, 1.75, 1);
      sprite.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      sprite.userData = { baseY, angle, offset: i * 0.7 };
      this.floatingNotesGroup.add(sprite);
    }

    this.scene.add(this.floatingNotesGroup);
  }

  private buildAmbientMotes(): void {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * (this.stageRadius + 6);
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 0.5 + Math.random() * 9.0;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.28,
      transparent: true,
      opacity: 0.55
    });
    this.ambientMotes = new THREE.Points(geo, mat);
    this.scene.add(this.ambientMotes);
  }

  private setupLighting(): void {
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x8BAEE8, 1.0);
    this.scene.add(hemiLight);

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const shadowRes = isMobile ? 1024 : 2048;

    const dirLight = new THREE.DirectionalLight(0xFFF3D6, 1.65);
    dirLight.position.set(22, 36, 24);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = shadowRes;
    dirLight.shadow.mapSize.height = shadowRes;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 90;
    const d = 27;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x36D6C5, 0.55);
    rimLight.position.set(-22, 16, -22);
    this.scene.add(rimLight);
  }

  public triggerDamageFlash(): void {
    this.damageFlashProgress = 0.0;
  }

  public triggerHitPulse(): void {
    this.hitPulseProgress = 0.0;
  }

  public update(time: number, isThreatNear = false, dt = 0.016): void {
    // Cloud drift & bobbing
    for (let i = 0; i < this.cloudsGroup.children.length; i++) {
      const puff = this.cloudsGroup.children[i];
      const ud = puff.userData;
      const a = ud.angle + time * ud.speed;
      puff.position.x = Math.cos(a) * ud.dist;
      puff.position.z = Math.sin(a) * ud.dist;
      puff.position.y = ud.baseY + Math.sin(time * 0.9 + i) * 0.35;
    }

    // Floating note icons
    for (let i = 0; i < this.floatingNotesGroup.children.length; i++) {
      const note = this.floatingNotesGroup.children[i];
      const ud = note.userData;
      note.position.y = ud.baseY + Math.sin(time * 1.9 + ud.offset) * 0.4;
    }

    // Ambient motes rotation
    this.ambientMotes.rotation.y = time * 0.04;

    // Hit pulse decay on speaker strips & grooves
    let pulseBoost = 0;
    if (this.hitPulseProgress < 1.0) {
      this.hitPulseProgress = Math.min(1.0, this.hitPulseProgress + dt * 4.5);
      pulseBoost = 1.0 - this.hitPulseProgress;
    }

    this.grooveMeshes.forEach((mesh, idx) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.14 + Math.sin(time * 3 + idx * 0.7) * 0.05 + pulseBoost * 0.25;
      mat.color.setHex(pulseBoost > 0.2 ? 0xFFD36E : 0x20BFA9);
    });

    const beatPulse = 1.0 + Math.sin(time * 6.5) * 0.08 + pulseBoost * 0.22;
    this.speakerCones.forEach(cone => {
      cone.scale.set(beatPulse, 1, beatPulse);
    });
    this.speakerStrips.forEach(strip => {
      const mat = strip.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.65 + pulseBoost * 1.8;
      mat.emissive.setHex(pulseBoost > 0.3 ? 0xFFD36E : 0x36D6C5);
    });

    const boundaryMat = this.protectiveBoundaryMesh.material as THREE.LineBasicMaterial;
    const diskMat = this.protectiveRingMesh.material as THREE.MeshBasicMaterial;

    if (this.damageFlashProgress < 1.0) {
      this.damageFlashProgress += dt * 3.5;
      boundaryMat.color.setHex(0xFF5C72);
      diskMat.color.setHex(0xFF5C72);
      diskMat.opacity = 0.45 * (1.0 - this.damageFlashProgress);
    } else if (isThreatNear) {
      const flash = (Math.sin(time * 12) + 1) * 0.5;
      boundaryMat.color.setHex(flash > 0.5 ? 0xFF5C72 : 0xFFD36E);
      diskMat.color.setHex(0xFF5C72);
      diskMat.opacity = 0.22 + flash * 0.14;
    } else {
      boundaryMat.color.setHex(pulseBoost > 0.25 ? 0xFFD36E : 0x36D6C5);
      diskMat.color.setHex(0x36D6C5);
      diskMat.opacity = 0.14 + Math.sin(time * 2.2) * 0.03 + pulseBoost * 0.12;
    }
  }
}
