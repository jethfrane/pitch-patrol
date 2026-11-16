/**
 * Pitch Patrol - Shared Web Audio Synthesizer & Mobile Audio Session Manager
 *
 * Uses a single shared AudioContext across playback and microphone capture so
 * iOS Safari / mobile browsers do not fight over two competing audio sessions.
 */

export const NOTE_FREQUENCIES: Record<string, number> = {
  'C3': 130.81, 'C♯3': 138.59, 'D3': 146.83, 'D♯3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F♯3': 185.00, 'G3': 196.00, 'G♯3': 207.65, 'A3': 220.00, 'A♯3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C♯4': 277.18, 'D4': 293.66, 'D♯4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F♯4': 369.99, 'G4': 392.00, 'G♯4': 415.30, 'A4': 440.00, 'A♯4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C♯5': 554.37, 'D5': 587.33, 'D♯5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F♯5': 739.99, 'G5': 783.99, 'G♯5': 830.61, 'A5': 880.00, 'A♯5': 932.33, 'B5': 987.77
};

export type AudioSessionMode = 'auto' | 'playback' | 'transient' | 'ambient' | 'play-and-record';

interface NavigatorWithAudioSession extends Navigator {
  audioSession?: {
    type: AudioSessionMode;
    state?: string;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
}

interface ActiveVoice {
  oscillators: OscillatorNode[];
  filter: BiquadFilterNode;
  gainNode: GainNode;
  releaseTimer?: number;
}

interface ToneOptions {
  type?: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  startOffset?: number;
  duration: number;
  peakGain: number;
  attack?: number;
  destination?: AudioNode;
}

export class SoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private resetTimer: number | null = null;
  public isMuted = false;
  public sfxVolume = 0.65;
  public pianoVolume = 0.85;

  private activeVoices: Map<string, ActiveVoice> = new Map();

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public initCtx(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.15, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setAudioSessionType(type: AudioSessionMode): void {
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithAudioSession) : undefined;
    if (!nav?.audioSession) return;
    if (this.resetTimer !== null) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    try {
      nav.audioSession.type = type;
    } catch {
      // Ignore browsers that expose a partial/read-only audioSession draft
    }
  }

  /**
   * Release iOS PlayAndRecord / call-style earpiece lock and restore media loudspeaker.
   */
  public restorePlaybackSession(keepPlayback = false): void {
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithAudioSession) : undefined;
    if (!nav?.audioSession) return;
    if (this.resetTimer !== null) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    try {
      nav.audioSession.type = 'playback';
      if (!keepPlayback) {
        this.resetTimer = window.setTimeout(() => {
          this.resetTimer = null;
          try {
            if (nav.audioSession) nav.audioSession.type = 'auto';
          } catch {}
        }, 80);
      }
    } catch {}
  }

  public getAudioSessionInfo(): string {
    const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithAudioSession) : undefined;
    if (!nav?.audioSession) return 'standard';
    const state = nav.audioSession.state ? ` (${nav.audioSession.state})` : '';
    return `${nav.audioSession.type}${state}`;
  }

  /**
   * Work around WebKit Bugs 218012 / 230902 where opening getUserMedia while
   * an AudioContext exists attenuates output volume or traps earpiece routing.
   */
  public async kickAudioContextForCapture(): Promise<void> {
    const ctx = this.initCtx();
    try {
      if (ctx.state === 'running') {
        await ctx.suspend();
      }
      await ctx.resume();
    } catch {
      // Ignore if context cannot suspend in restricted test environments
    }
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.masterGain ?? ctx.destination;
  }

  private scheduleTone(ctx: AudioContext, opts: ToneOptions): void {
    const start = ctx.currentTime + (opts.startOffset ?? 0);
    const attack = opts.attack ?? 0.012;
    const end = start + Math.max(opts.duration, attack + 0.02);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freqStart, start);
    if (opts.freqEnd && opts.freqEnd !== opts.freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), end);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, opts.peakGain), start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(opts.destination ?? this.getOutputNode(ctx));
    osc.start(start);
    osc.stop(end + 0.01);
  }

  // -------------------------------------------------------------
  // POLYPHONIC SYNTHESIZED PIANO
  // -------------------------------------------------------------

  public startPianoNote(noteName: string, octave = 4): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const key = `${noteName}${octave}`;
    const baseFreq = NOTE_FREQUENCIES[key] || NOTE_FREQUENCIES[`${noteName}4`] || 440;

    this.stopPianoNote(noteName, octave);

    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5200, baseFreq * 8), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(900, baseFreq * 2.8), now + 0.5);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(Math.max(0.01, this.pianoVolume * 0.55), now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.01, this.pianoVolume * 0.22), now + 0.45);

    const harmonics = [
      { mult: 1.0, type: 'triangle' as OscillatorType, gain: 0.65 },
      { mult: 2.0, type: 'sine' as OscillatorType, gain: 0.28 },
      { mult: 3.0, type: 'sine' as OscillatorType, gain: 0.12 },
      { mult: 4.0, type: 'sine' as OscillatorType, gain: 0.05 }
    ];

    const oscillators: OscillatorNode[] = harmonics.map(h => {
      const osc = ctx.createOscillator();
      osc.type = h.type;
      osc.frequency.setValueAtTime(baseFreq * h.mult, now);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(h.gain, now);

      osc.connect(subGain);
      subGain.connect(filter);
      osc.start(now);
      return osc;
    });

    filter.connect(gainNode);
    gainNode.connect(this.getOutputNode(ctx));

    this.activeVoices.set(key, { oscillators, filter, gainNode });
  }

  public stopPianoNote(noteName: string, octave = 4): void {
    const key = `${noteName}${octave}`;
    const voice = this.activeVoices.get(key);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(Math.max(0.0002, voice.gainNode.gain.value), now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    if (voice.releaseTimer) window.clearTimeout(voice.releaseTimer);
    voice.releaseTimer = window.setTimeout(() => {
      voice.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch {}
      });
      try { voice.filter.disconnect(); voice.gainNode.disconnect(); } catch {}
    }, 165);

    this.activeVoices.delete(key);
  }

  public releaseAllPianoNotes(): void {
    this.activeVoices.forEach(voice => {
      if (this.ctx) {
        const now = this.ctx.currentTime;
        voice.gainNode.gain.cancelScheduledValues(now);
        voice.gainNode.gain.setValueAtTime(Math.max(0.0002, voice.gainNode.gain.value), now);
        voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      }
      if (voice.releaseTimer) window.clearTimeout(voice.releaseTimer);
      window.setTimeout(() => {
        voice.oscillators.forEach(osc => {
          try { osc.stop(); osc.disconnect(); } catch {}
        });
        try { voice.filter.disconnect(); voice.gainNode.disconnect(); } catch {}
      }, 115);
    });
    this.activeVoices.clear();
  }

  // -------------------------------------------------------------
  // GAMEPLAY SOUND EFFECTS
  // -------------------------------------------------------------

  public playPulse(noteName: string, isPerfect = false): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const baseFreq = NOTE_FREQUENCIES[`${noteName}4`] || 440;
    this.scheduleTone(ctx, {
      type: 'triangle',
      freqStart: baseFreq,
      freqEnd: baseFreq * 1.5,
      duration: 0.18,
      peakGain: this.sfxVolume * 0.42,
      attack: 0.008
    });
    if (isPerfect) {
      this.scheduleTone(ctx, {
        type: 'sine',
        freqStart: baseFreq * 2,
        freqEnd: baseFreq * 2.5,
        startOffset: 0.03,
        duration: 0.2,
        peakGain: this.sfxVolume * 0.28,
        attack: 0.01
      });
    }
  }

  public playHitImpact(isDefeat: boolean, comboMultiplier = 1, isPerfect = false): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    // Punchy knockback transient
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 240,
      freqEnd: 78,
      duration: 0.13,
      peakGain: this.sfxVolume * 0.45,
      attack: 0.004
    });

    if (isDefeat) {
      this.playDefeat(comboMultiplier, isPerfect);
    } else {
      // Armor crack / knockback ring
      this.scheduleTone(ctx, {
        type: 'triangle',
        freqStart: 440,
        freqEnd: 330,
        startOffset: 0.02,
        duration: 0.16,
        peakGain: this.sfxVolume * 0.34,
        attack: 0.006
      });
    }
  }

  public playDefeat(comboMultiplier = 1, isPerfect = false): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    const baseIndex = Math.min(Math.floor(comboMultiplier) - 1, 2);

    const chord = isPerfect
      ? [freqs[baseIndex], freqs[baseIndex + 1], freqs[baseIndex + 2]]
      : [freqs[baseIndex], freqs[baseIndex + 1]];

    chord.forEach((freq, idx) => {
      this.scheduleTone(ctx, {
        type: 'triangle',
        freqStart: freq,
        startOffset: idx * 0.04,
        duration: 0.28,
        peakGain: this.sfxVolume * 0.38,
        attack: 0.01
      });
    });
  }

  public playNovaSkill(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    // Deep radiant sub-boom
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 165,
      freqEnd: 48,
      duration: 0.45,
      peakGain: this.sfxVolume * 0.65,
      attack: 0.006
    });
    // Rising Cmaj9 harmonic shimmer
    [261.63, 329.63, 392.00, 493.88, 587.33, 783.99].forEach((freq, i) => {
      this.scheduleTone(ctx, {
        type: 'triangle',
        freqStart: freq,
        freqEnd: freq * 1.015,
        startOffset: i * 0.035,
        duration: 0.55,
        peakGain: this.sfxVolume * 0.32,
        attack: 0.015
      });
    });
  }

  public playShieldKnockback(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 320,
      freqEnd: 140,
      duration: 0.16,
      peakGain: this.sfxVolume * 0.35,
      attack: 0.005
    });
  }

  public playPlayerDamage(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    this.scheduleTone(ctx, {
      type: 'sawtooth',
      freqStart: 150,
      freqEnd: 46,
      duration: 0.24,
      peakGain: this.sfxVolume * 0.48,
      attack: 0.005
    });
  }

  public playWaveTransition(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    [392.00, 523.25, 659.25, 783.99].forEach((freq, idx) => {
      this.scheduleTone(ctx, {
        type: 'sine',
        freqStart: freq,
        startOffset: idx * 0.075,
        duration: 0.38,
        peakGain: this.sfxVolume * 0.34,
        attack: 0.015
      });
    });
  }

  public playProximityWarning(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 220,
      freqEnd: 196,
      duration: 0.11,
      peakGain: this.sfxVolume * 0.2,
      attack: 0.006
    });
  }

  public playGameOver(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    [392.00, 329.63, 261.63, 196.00].forEach((freq, i) => {
      this.scheduleTone(ctx, {
        type: 'sine',
        freqStart: freq,
        startOffset: i * 0.13,
        duration: 0.78,
        peakGain: this.sfxVolume * 0.38,
        attack: 0.012
      });
    });
  }

  public playReferenceTone(noteName: string, durationMs = 800): void {
    const ctx = this.initCtx();
    const baseFreq = NOTE_FREQUENCIES[`${noteName}4`] || 440;
    const durSec = durationMs / 1000;
    this.scheduleTone(ctx, {
      type: 'triangle',
      freqStart: baseFreq,
      duration: durSec,
      peakGain: Math.max(0.35, this.sfxVolume * 0.55),
      attack: 0.035
    });
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: baseFreq * 2,
      duration: durSec * 0.85,
      peakGain: Math.max(0.12, this.sfxVolume * 0.18),
      attack: 0.04
    });
  }
}

export const soundSynth = new SoundSynth();
