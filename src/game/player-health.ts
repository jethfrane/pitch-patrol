/**
 * Pitch Patrol - Player Health & Damage Recovery System
 * Health-based survival: 100 HP with discrete attack cycles and invulnerability grace.
 */

export class PlayerHealth {
  public readonly maxHp = 100;
  public currentHp = 100;
  public invulnerabilityDuration = 0.6; // 600ms grace period
  private invulnerabilityTimer = 0;

  public onHealthChange?: (hp: number, maxHp: number) => void;
  public onDamageTaken?: (amount: number, remainingHp: number) => void;
  public onDeath?: () => void;

  constructor() {
    this.currentHp = this.maxHp;
  }

  public get isInvulnerable(): boolean {
    return this.invulnerabilityTimer > 0;
  }

  public takeDamage(amount: number): boolean {
    if (this.isInvulnerable || this.currentHp <= 0) {
      return false;
    }

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.invulnerabilityTimer = this.invulnerabilityDuration;

    if (this.onDamageTaken) {
      this.onDamageTaken(amount, this.currentHp);
    }

    if (this.onHealthChange) {
      this.onHealthChange(this.currentHp, this.maxHp);
    }

    if (this.currentHp <= 0 && this.onDeath) {
      this.onDeath();
    }

    return true;
  }

  public heal(amount: number): void {
    if (this.currentHp <= 0) return;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
    if (this.onHealthChange) {
      this.onHealthChange(this.currentHp, this.maxHp);
    }
  }

  public reset(): void {
    this.currentHp = this.maxHp;
    this.invulnerabilityTimer = 0;
    if (this.onHealthChange) {
      this.onHealthChange(this.currentHp, this.maxHp);
    }
  }

  public update(dt: number): void {
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer -= dt;
      if (this.invulnerabilityTimer < 0) {
        this.invulnerabilityTimer = 0;
      }
    }
  }
}
