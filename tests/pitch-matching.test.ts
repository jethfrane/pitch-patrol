import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchMatchStateMachine } from '../src/audio/pitch-match-state-machine.ts';
import { PlayerHealth } from '../src/game/player-health.ts';
import { normalizeNoteName } from '../src/audio/pitch-detector.ts';

test('1. Silence or unvoiced audio produces zero attacks', () => {
  const sm = new PitchMatchStateMachine({ requiredHoldMs: 280, toleranceCents: 35 });
  let attacksFired = 0;
  sm.onAttackAuthorized = () => attacksFired++;

  // 100 frames of silence (null note)
  for (let i = 0; i < 100; i++) {
    const status = sm.update(null, 4, 0, 0, 0.016);
    assert.equal(status.canAttack, false);
  }

  assert.equal(attacksFired, 0);
});

test('2. Low confidence noisy audio is rejected', () => {
  const sm = new PitchMatchStateMachine({ minConfidence: 0.80 });
  let attacksFired = 0;
  sm.onAttackAuthorized = () => attacksFired++;

  // Audio detected as C4, but confidence is low (0.50)
  for (let i = 0; i < 50; i++) {
    const status = sm.update('C', 4, 0, 0.50, 0.016);
    assert.equal(status.canAttack, false);
  }

  assert.equal(attacksFired, 0);
});

test('3. Brief pitch sweeps (<280ms) do not authorize attacks', () => {
  const sm = new PitchMatchStateMachine({ requiredHoldMs: 280 });
  let attacksFired = 0;
  sm.onAttackAuthorized = () => attacksFired++;

  // Sweep through 'D' for 100ms (below 280ms threshold)
  for (let i = 0; i < 6; i++) { // ~96ms
    sm.update('D', 4, 5, 0.95, 0.016);
  }

  // Switch to 'E' for 80ms
  for (let i = 0; i < 5; i++) {
    sm.update('E', 4, 0, 0.95, 0.016);
  }

  assert.equal(attacksFired, 0);
});

test('4. Sustained stable in-tune pitch authorizes exactly one attack', () => {
  const sm = new PitchMatchStateMachine({ requiredHoldMs: 280 });
  let attacksFired = 0;
  let attackNote = '';
  sm.onAttackAuthorized = (note) => {
    attacksFired++;
    attackNote = note;
  };

  // Sing D4 in-tune (+10 cents) for 320ms (20 frames @ 16ms = 320ms)
  for (let i = 0; i < 20; i++) {
    sm.update('D', 4, 10, 0.95, 0.016);
  }

  assert.equal(attacksFired, 1);
  assert.equal(attackNote, 'D');

  // Holding the note for another 500ms must NOT fire additional attacks without rearming
  for (let i = 0; i < 30; i++) {
    sm.update('D', 4, 10, 0.95, 0.016);
  }
  // Total attacks must remain 1
  assert.equal(attacksFired, 1);
});

test('5. Switching note candidate immediately resets hold progress', () => {
  const sm = new PitchMatchStateMachine({ requiredHoldMs: 280 });
  let attacksFired = 0;
  sm.onAttackAuthorized = () => attacksFired++;

  // Sing 'C' for 200ms (71% progress)
  for (let i = 0; i < 12; i++) {
    sm.update('C', 4, 0, 0.95, 0.016);
  }
  const status1 = sm.update('C', 4, 0, 0.95, 0.016);
  assert.ok(status1.holdProgress > 0.5);

  // Switch abruptly to 'G' -> progress must reset
  const status2 = sm.update('G', 4, 0, 0.95, 0.016);
  assert.equal(status2.candidateNote, 'G');
  assert.ok(status2.holdProgress < 0.2);
  assert.equal(attacksFired, 0);
});

test('6. Brief dropout (<60ms) preserves candidate without adding hold time', () => {
  const sm = new PitchMatchStateMachine({ requiredHoldMs: 280, dropoutGraceMs: 60 });

  // Hold 'A' for 160ms
  for (let i = 0; i < 10; i++) {
    sm.update('A', 4, 0, 0.95, 0.016);
  }
  const progBefore = sm.update('A', 4, 0, 0.95, 0.016).holdProgress;

  // 1 frame dropout (16ms)
  const dropStatus = sm.update(null, 4, 0, 0, 0.016);
  // Candidate preserved
  assert.equal(dropStatus.candidateNote, 'A');
  // Hold progress did not increase during dropout
  assert.equal(dropStatus.holdProgress, progBefore);
});

test('7. Player Health handles damage, invulnerability grace, and game over', () => {
  const health = new PlayerHealth();
  assert.equal(health.currentHp, 100);

  let damageEvents = 0;
  let deaths = 0;
  health.onDamageTaken = () => damageEvents++;
  health.onDeath = () => deaths++;

  // First hit: 15 damage
  const hit1 = health.takeDamage(15);
  assert.equal(hit1, true);
  assert.equal(health.currentHp, 85);
  assert.equal(damageEvents, 1);
  assert.equal(health.isInvulnerable, true);

  // Successive immediate hits within 0.6s grace period must be blocked
  const hitBlocked = health.takeDamage(15);
  assert.equal(hitBlocked, false);
  assert.equal(health.currentHp, 85);
  assert.equal(damageEvents, 1);

  // Advance time past invulnerability window (0.7s)
  health.update(0.7);
  assert.equal(health.isInvulnerable, false);

  // Second valid hit
  const hit2 = health.takeDamage(85);
  assert.equal(hit2, true);
  assert.equal(health.currentHp, 0);
  assert.equal(damageEvents, 2);
  assert.equal(deaths, 1);
});

test('8. Enharmonic accidental normalization', () => {
  assert.equal(normalizeNoteName('Db'), 'C♯');
  assert.equal(normalizeNoteName('D♭'), 'C♯');
  assert.equal(normalizeNoteName('Eb'), 'D♯');
  assert.equal(normalizeNoteName('E♭'), 'D♯');
  assert.equal(normalizeNoteName('Gb'), 'F♯');
  assert.equal(normalizeNoteName('G♭'), 'F♯');
  assert.equal(normalizeNoteName('Bb'), 'A♯');
  assert.equal(normalizeNoteName('B♭'), 'A♯');
  assert.equal(normalizeNoteName('C#'), 'C♯');
  assert.equal(normalizeNoteName('F#'), 'F♯');
});
