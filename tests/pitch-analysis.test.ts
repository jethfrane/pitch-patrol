import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePitch, frequencyToNote } from '../src/audio/pitch-analysis.ts';
for(const rate of [44100,48000]) for(const frequency of [82.407,130.813,261.626,369.994,440,880]) {
  test(`Detect ${frequency} Hz at ${rate} Hz with low amplitude and harmonics`,()=>{
    const b=Float32Array.from({length:2048},(_,i)=>0.006*(Math.sin(2*Math.PI*frequency*i/rate)+0.3*Math.sin(4*Math.PI*frequency*i/rate)));
    const result=analyzePitch(b,rate);
    assert.ok(result.confidence>0.9);
    assert.ok(Math.abs(1200*Math.log2(result.frequency/frequency))<8, `${result.frequency}`);
  });
}
test('Silence and deterministic broad-band noise are rejected',()=>{
  assert.equal(analyzePitch(new Float32Array(2048),48000).frequency,-1);
  let seed=123;const noise=Float32Array.from({length:2048},()=>{seed=(seed*16807)%2147483647;return (seed/2147483647-.5)*.1;});
  assert.equal(analyzePitch(noise,48000).frequency,-1);
});
test('Note conversion preserves accidental and cents',()=>{
  const result=frequencyToNote(369.994 * 2**(17/1200));
  assert.equal(result.noteName,'F♯');assert.equal(result.octave,4);assert.ok(Math.abs(result.cents-17)<.1);
});
