import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  NovaSkill,
  NOVA_MAX_CHARGE,
  chooseEnemyBlueprint,
  computeHitScore
} from '../src/game/combat.ts';
import { Enemy } from '../src/game/enemies.ts';

function withMockCanvasDocument(fn: () => void): void {
  const origDoc = globalThis.document;
  const noop = () => {};
  const ctx = {
    clearRect: noop,
    beginPath: noop,
    roundRect: noop,
    fill: noop,
    stroke: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    arc: noop,
    fillText: noop,
    strokeText: noop,
    shadowColor: '',
    shadowBlur: 0,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: ''
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx })
    }
  });
  try {
    fn();
  } finally {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: origDoc });
  }
}

test('NovaSkill charges up to 100, consumes cleanly, and resets', () => {
  const nova = new NovaSkill();
  assert.equal(nova.isReady, false);
  assert.equal(nova.consume(), false);

  nova.addCharge(60);
  assert.equal(nova.isReady, false);
  assert.equal(nova.progress, 0.6);

  nova.addCharge(80);
  assert.equal(nova.charge, NOVA_MAX_CHARGE);
  assert.equal(nova.isReady, true);

  assert.equal(nova.consume(), true);
  assert.equal(nova.charge, 0);
  assert.equal(nova.isReady, false);

  nova.addCharge(50);
  nova.reset();
  assert.equal(nova.charge, 0);
});

test('chooseEnemyBlueprint scales HP and spawns Maestro Boss on every 3rd wave', () => {
  const w1 = chooseEnemyBlueprint(1, 0, 7, 0.85);
  assert.equal(w1.type, 'bass-blob');
  assert.equal(w1.hp, 1);

  const w2 = chooseEnemyBlueprint(2, 0, 10, 0.85);
  assert.equal(w2.type, 'bass-blob');
  assert.equal(w2.hp, 2);

  const w3Boss = chooseEnemyBlueprint(3, 12, 13, 0.1);
  assert.equal(w3Boss.type, 'maestro-boss');
  assert.equal(w3Boss.hp, 3);
});

test('computeHitScore applies combo and perfect pitch bonus', () => {
  assert.equal(computeHitScore(100, 1.0, false), 100);
  assert.equal(computeHitScore(100, 2.0, true), 270);
});

test('Armored enemy survives first hit, gets knocked back outward, and dies on second hit', () => {
  withMockCanvasDocument(() => {
    const scene = new THREE.Scene();
    const enemy = new Enemy(scene, {
      type: 'bass-blob',
      note: 'C',
      speed: 2.0,
      spawnAngle: 0,
      damage: 14,
      hp: 2
    }, 22);

    enemy.group.position.set(8, 0, 0);
    const distBefore = enemy.getDistanceToCenter();

    const killed1 = enemy.hit(11);
    assert.equal(killed1, false);
    assert.equal(enemy.hp, 1);
    assert.equal(enemy.state, 'approaching');

    enemy.update(0.08, 3.8);
    enemy.update(0.08, 3.8);
    const distAfter = enemy.getDistanceToCenter();
    assert.ok(distAfter > distBefore, `Expected knockback outward (${distAfter} > ${distBefore})`);

    const killed2 = enemy.hit(10);
    assert.equal(killed2, true);
    assert.equal(enemy.state, 'dying');

    enemy.destroy(scene);
  });
});

test('applyKnockback interrupts enemy wind-up attack', () => {
  withMockCanvasDocument(() => {
    const scene = new THREE.Scene();
    const enemy = new Enemy(scene, {
      type: 'note-sprite',
      note: 'G',
      speed: 2.0,
      spawnAngle: Math.PI / 2,
      damage: 10,
      hp: 1
    }, 22);

    enemy.group.position.set(0, 0, 3.9);
    enemy.update(0.016, 3.8);
    assert.equal(enemy.state, 'winding_up');

    enemy.applyKnockback(8.0);
    assert.equal(enemy.state, 'approaching');
    enemy.update(0.08, 3.8);
    assert.ok(enemy.getDistanceToCenter() > 3.9);

    enemy.destroy(scene);
  });
});
