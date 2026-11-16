/**
 * Pitch Patrol - Combat, Harmonic Nova Skill, & Wave Balancing Helpers
 * Pure TypeScript module for deterministic unit testing and clean engine state.
 */

import { EnemyType } from './enemies';

export const NOVA_MAX_CHARGE = 100;
export const NOVA_HEAL_AMOUNT = 10;
export const NOVA_KNOCKBACK_FORCE = 13.5;

export class NovaSkill {
  public charge = 0;

  public get isReady(): boolean {
    return this.charge >= NOVA_MAX_CHARGE;
  }

  public get progress(): number {
    return Math.min(1, this.charge / NOVA_MAX_CHARGE);
  }

  public addCharge(amount: number): boolean {
    if (amount <= 0) return this.isReady;
    this.charge = Math.min(NOVA_MAX_CHARGE, this.charge + amount);
    return this.isReady;
  }

  public consume(): boolean {
    if (!this.isReady) return false;
    this.charge = 0;
    return true;
  }

  public reset(): void {
    this.charge = 0;
  }
}

export interface SpawnBlueprint {
  type: EnemyType;
  speed: number;
  damage: number;
  hp: number;
}

export function chooseEnemyBlueprint(wave: number, spawnedIndex: number, waveTotal: number, roll = Math.random()): SpawnBlueprint {
  // Spawn a Maestro Boss as the final threat of every 3rd wave
  if (wave >= 3 && wave % 3 === 0 && spawnedIndex === waveTotal - 1) {
    return {
      type: 'maestro-boss',
      speed: Math.min(2.1, 1.2 + (wave - 3) * 0.08),
      damage: 18,
      hp: 3
    };
  }

  let type: EnemyType = 'note-sprite';
  let speed = 1.65 + (wave - 1) * 0.1;
  let damage = 10;
  let hp = 1;

  if (roll < 0.44) {
    type = 'note-sprite';
    speed = 1.65 + (wave - 1) * 0.1;
    damage = 10;
  } else if (roll < 0.74) {
    type = 'metronome-runner';
    speed = 2.65 + (wave - 1) * 0.14;
    damage = 8;
  } else if (roll < 0.90) {
    type = 'bass-blob';
    speed = 1.15 + (wave - 1) * 0.08;
    damage = 14;
    hp = wave >= 2 ? 2 : 1;
  } else {
    type = 'chord-cloud';
    speed = 1.4 + (wave - 1) * 0.1;
    damage = 12;
    hp = wave >= 4 ? 2 : 1;
  }

  speed = Math.min(speed, 3.6);
  if (wave === 1) speed *= 0.68;

  return { type, speed, damage, hp };
}

export function computeHitScore(basePoints: number, combo: number, isPerfect: boolean): number {
  const perfectBonus = isPerfect ? 1.35 : 1.0;
  return Math.round(basePoints * combo * perfectBonus);
}
