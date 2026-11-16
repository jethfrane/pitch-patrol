import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundSynth, AudioSessionMode } from '../src/audio/sound-synth.ts';

test('SoundSynth restores playback audioSession cleanly when supported', async () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  const audioSession: { type: AudioSessionMode; state: string } = {
    type: 'play-and-record',
    state: 'active'
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { audioSession }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout, clearTimeout }
  });

  try {
    const synth = new SoundSynth();
    assert.equal(synth.getAudioSessionInfo(), 'play-and-record (active)');

    synth.restorePlaybackSession(true);
    assert.equal(audioSession.type, 'playback');

    synth.restorePlaybackSession(false);
    assert.equal(audioSession.type, 'playback');
    await new Promise(resolve => setTimeout(resolve, 110));
    assert.equal(audioSession.type, 'auto');
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});
