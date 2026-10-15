/**
 * Pitch Patrol - Comprehensive Procedural Web Audio Sound Synthesizer
 * Polyphonic Piano Synth + Complete Game SFX Suite.
 */

export const NOTE_FREQUENCIES: Record<string, number> = {
  'C3': 130.81, 'C♯3': 138.59, 'D3': 146.83, 'D♯3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F♯3': 185.00, 'G3': 196.00, 'G♯3': 207.65, 'A3': 220.00, 'A♯3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C♯4': 277.18, 'D4': 293.66, 'D♯4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F♯4': 369.99, 'G4': 392.00, 'G♯4': 415.30, 'A4': 440.00, 'A♯4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C♯5': 554.37, 'D5': 587.33, 'D♯5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F♯5': 739.99, 'G5': 783.99, 'G♯5': 830.61, 'A5': 880.00, 'A♯5': 932.33, 'B5': 987.77
};

interface ActiveVoice {
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  noteKey: string;
}

export class SoundSynth {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  public sfxVolume = 0.6;
  public pianoVolume = 0.7;

  private activeVoices: Map<string, ActiveVoice> = new Map();

  public initCtx(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // -------------------------------------------------------------
  // POLYPHONIC SYNTHESIZED PIANO
  // -------------------------------------------------------------

  /**
   * Play a piano note with natural attack, harmonic decay, and sustain
   */
  public startPianoNote(noteName: string, octave = 4): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const key = `${noteName}${octave}`;
    const baseFreq = NOTE_FREQUENCIES[key] || NOTE_FREQUENCIES[`${noteName}4`] || 440;

    // Release existing voice for this key if already playing
    this.stopPianoNote(noteName, octave);

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    // Instant hammer attack
    gainNode.gain.linearRampToValueAtTime(this.pianoVolume * 0.45, now + 0.008);
    // Natural acoustic decay to warm sustain
    gainNode.gain.exponentialRampToValueAtTime(this.pianoVolume * 0.18, now + 0.35);

    // Multi-harmonic oscillator stack for rich acoustic piano-like timber
    const harmonics = [
      { mult: 1.0, type: 'triangle' as OscillatorType, gain: 0.6 },
      { mult: 2.0, type: 'sine' as OscillatorType, gain: 0.25 },
      { mult: 3.0, type: 'sine' as OscillatorType, gain: 0.12 },
      { mult: 4.0, type: 'sine' as OscillatorType, gain: 0.05 }
    ];

    const oscillators: OscillatorNode[] = [];

    harmonics.forEach(h => {
      const osc = ctx.createOscillator();
      osc.type = h.type;
      osc.frequency.setValueAtTime(baseFreq * h.mult, now);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(h.gain, now);

      osc.connect(subGain);
      subGain.connect(gainNode);
      osc.start(now);
      oscillators.push(osc);
    });

    gainNode.connect(ctx.destination);

    this.activeVoices.set(key, { oscillators, gainNode, noteKey: key });
  }

  /**
   * Release a piano note smoothly with damper sound
   */
  public stopPianoNote(noteName: string, octave = 4): void {
    const key = `${noteName}${octave}`;
    const voice = this.activeVoices.get(key);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    setTimeout(() => {
      voice.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (_) {}
      });
      voice.gainNode.disconnect();
    }, 150);

    this.activeVoices.delete(key);
  }

  public releaseAllPianoNotes(): void {
    this.activeVoices.forEach(voice => {
      if (this.ctx) {
        const now = this.ctx.currentTime;
        voice.gainNode.gain.cancelScheduledValues(now);
        voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
        voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      }
      setTimeout(() => {
        voice.oscillators.forEach(osc => {
          try { osc.stop(); osc.disconnect(); } catch (_) {}
        });
        voice.gainNode.disconnect();
      }, 100);
    });
    this.activeVoices.clear();
  }

  // -------------------------------------------------------------
  // GAMEPLAY SOUND EFFECTS
  // -------------------------------------------------------------

  /**
   * Musical projectile launch sound
   */
  public playPulse(noteName: string): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const baseFreq = NOTE_FREQUENCIES[`${noteName}4`] || 440;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.14);

    gain.gain.setValueAtTime(this.sfxVolume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Sparkling bell chime when an enemy is defeated
   */
  public playDefeat(comboMultiplier = 1): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const baseIndex = Math.min(Math.floor(comboMultiplier) - 1, 2);

    [freqs[baseIndex], freqs[baseIndex + 1]].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.32, now + idx * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.3);
    });
  }

  /**
   * Player damage impact sound (punchy low thud)
   */
  public playPlayerDamage(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.2);

    gain.gain.setValueAtTime(this.sfxVolume * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Wave transition fanfare arpeggio
   */
  public playWaveTransition(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const notes = [392.00, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.28, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  /**
   * Subtle alert when threat is near inner ring
   */
  public playProximityWarning(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(196, now + 0.09);

    gain.gain.setValueAtTime(this.sfxVolume * 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Game Over descending chime
   */
  public playGameOver(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    const chord = [392.00, 329.63, 261.63, 196.00];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);

      gain.gain.setValueAtTime(this.sfxVolume * 0.35, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.9);
    });
  }

  /**
   * Play clean reference pitch for training / ear learning
   */
  public playReferenceTone(noteName: string, durationMs = 800): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;
    const baseFreq = NOTE_FREQUENCIES[`${noteName}4`] || 440;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.3, now + 0.04);
    gain.gain.setValueAtTime(this.sfxVolume * 0.3, now + (durationMs / 1000) - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, now + (durationMs / 1000));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + (durationMs / 1000));
  }
}

export const soundSynth = new SoundSynth();
