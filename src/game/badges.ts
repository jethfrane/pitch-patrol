/**
 * Pitch Patrol - High-DPI Upright Screen-Facing Note Badges
 * Enhanced accidental rendering (C♯, F♯, B♭, E♭) with zero clipping.
 */

import * as THREE from 'three';

export class NoteBadge {
  public sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  public noteText: string;
  public isTargeted = false;

  constructor(noteText: string) {
    this.noteText = noteText;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 160;
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
    this.sprite.scale.set(6.2, 3.1, 1);
    this.renderBadge();
  }

  public setTargeted(targeted: boolean): void {
    if (this.isTargeted !== targeted) {
      this.isTargeted = targeted;
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

    const w = 240;
    const h = 104;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    const radius = 26;

    // Glowing outline
    if (this.isTargeted) {
      ctx.shadowColor = '#36D6C5';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#36D6C5';
      ctx.lineWidth = 9;
    } else {
      ctx.shadowColor = 'rgba(24, 35, 63, 0.3)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#18233F';
      ctx.lineWidth = 5;
    }

    // Badge Background Pill
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = this.isTargeted ? '#EAF4FF' : '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    // Reset shadow for crisp text
    ctx.shadowBlur = 0;

    // Note Text
    ctx.fillStyle = this.isTargeted ? '#17213A' : '#18233F';
    // Slightly adjust font size if text has accidentals like C♯ or chord like Am
    const fontSize = this.noteText.length > 2 ? 76 : 90;
    ctx.font = `900 ${fontSize}px "Quicksand", system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.noteText, canvas.width / 2, canvas.height / 2 + 2);

    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.texture.dispose();
    (this.sprite.material as THREE.Material).dispose();
  }
}
