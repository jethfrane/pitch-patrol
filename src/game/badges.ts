/**
 * Pitch Patrol - High-DPI Upright Screen-Facing Note Badges
 * Sleek, non-obscuring badges positioned above creatures with multi-HP pips and live match glow.
 */

import * as THREE from 'three';

export class NoteBadge {
  public sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  public noteText: string;
  public isTargeted = false;
  public isMatching = false;
  public hp = 1;
  public maxHp = 1;

  constructor(noteText: string, maxHp = 1) {
    this.noteText = noteText;
    this.hp = maxHp;
    this.maxHp = maxHp;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 280;
    this.canvas.height = 156;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      toneMapped: false
    });

    this.sprite = new THREE.Sprite(material);
    this.sprite.scale.set(3.5, 1.95, 1);
    this.sprite.renderOrder = 10;
    this.renderBadge();
  }

  public setTargeted(targeted: boolean): void {
    if (this.isTargeted !== targeted) {
      this.isTargeted = targeted;
      this.renderBadge();
    }
  }

  public setMatching(matching: boolean): void {
    if (this.isMatching !== matching) {
      this.isMatching = matching;
      this.renderBadge();
    }
  }

  public setHp(hp: number, maxHp = this.maxHp): void {
    if (this.hp !== hp || this.maxHp !== maxHp) {
      this.hp = hp;
      this.maxHp = maxHp;
      this.renderBadge();
    }
  }

  public setNote(noteText: string): void {
    if (this.noteText !== noteText) {
      this.noteText = noteText;
      this.renderBadge();
    }
  }

  private renderBadge(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = 196;
    const h = 88;
    const x = (canvas.width - w) / 2;
    const y = 18;
    const radius = 26;

    // Outer glow & border
    if (this.isMatching) {
      ctx.shadowColor = '#FFD36E';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = '#FFB703';
      ctx.lineWidth = 8;
    } else if (this.isTargeted) {
      ctx.shadowColor = '#36D6C5';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#20BFA9';
      ctx.lineWidth = 7;
    } else {
      ctx.shadowColor = 'rgba(23, 33, 58, 0.28)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#18233F';
      ctx.lineWidth = 4.5;
    }

    // Pill background
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = this.isMatching ? '#FFF8DE' : this.isTargeted ? '#EAFFFB' : '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    // Small downward pointer triangle
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 11, y + h - 1);
    ctx.lineTo(canvas.width / 2 + 11, y + h - 1);
    ctx.lineTo(canvas.width / 2, y + h + 13);
    ctx.closePath();
    ctx.fillStyle = this.isMatching ? '#FFB703' : this.isTargeted ? '#20BFA9' : '#18233F';
    ctx.fill();

    // Note label
    ctx.fillStyle = '#17213A';
    const fontSize = this.noteText.length > 2 ? 56 : 66;
    ctx.font = `900 ${fontSize}px "Quicksand", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.noteText, canvas.width / 2, y + h / 2 + 2);

    // Multi-HP pips below pointer when armored / boss
    if (this.maxHp > 1) {
      const gap = 22;
      const totalW = (this.maxHp - 1) * gap;
      const startX = canvas.width / 2 - totalW / 2;
      const pipY = y + h + 28;
      for (let i = 0; i < this.maxHp; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * gap, pipY, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = i < this.hp ? '#FF5C72' : 'rgba(24, 35, 63, 0.22)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      }
    }

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
    (this.sprite.material as THREE.Material).dispose();
  }
}
