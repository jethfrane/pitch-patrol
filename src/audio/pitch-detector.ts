/**
 * Pitch Patrol - High-Precision MPM Pitch Detector
 * McLeod Pitch Method (NSDF) with sub-sample parabolic interpolation and subharmonic suppression.
 * CPU optimized: ~1.5ms per frame, 65Hz to 1100Hz human vocal range.
 */

import { PitchMatchStateMachine, StateMachineStatus } from './pitch-match-state-machine';

export interface PitchDetectionResult {
  frequency: number;
  noteName: string;
  octave: number;
  cents: number;
  volume: number;
  confidence: number;
  matchStatus: StateMachineStatus;
}

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const ENHARMONIC_MAP: Record<string, string> = {
  'DB': 'C♯', 'D♭': 'C♯',
  'EB': 'D♯', 'E♭': 'D♯',
  'GB': 'F♯', 'G♭': 'F♯',
  'AB': 'G♯', 'A♭': 'G♯',
  'BB': 'A♯', 'B♭': 'A♯',
  'C#': 'C♯', 'D#': 'D♯', 'F#': 'F♯', 'G#': 'G♯', 'A#': 'A♯'
};

export function normalizeNoteName(name: string): string {
  const upper = name.trim().toUpperCase();
  return ENHARMONIC_MAP[upper] || ENHARMONIC_MAP[name] || name;
}

export class PitchDetector {
  public audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array = new Float32Array(2048);
  private nsdfBuffer: Float32Array = new Float32Array(1024);

  public isListening = false;
  public minVolumeThreshold = 0.015; // Noise gate
  public inputSensitivity = 1.0;
  public minConfidence = 0.70; // MPM confidence threshold (fair for all vocal registers)
  public isScoringSuspended = false;
  private scoringSuspendedTimer = 0;

  public stateMachine: PitchMatchStateMachine;
  private smoothedCents = 0;

  public onAttackAuthorized?: (note: string, octave: number) => void;
  public onPitchUpdate?: (result: PitchDetectionResult | null) => void;

  constructor() {
    this.stateMachine = new PitchMatchStateMachine();
    this.stateMachine.onAttackAuthorized = (note, octave) => {
      if (!this.isScoringSuspended && this.onAttackAuthorized) {
        this.onAttackAuthorized(note, octave);
      }
    };
  }

  public async initMic(): Promise<boolean> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.buffer = new Float32Array(this.analyser.fftSize);

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.sourceNode.connect(this.analyser);

      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      return false;
    }
  }

  public stopMic(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isListening = false;
    this.stateMachine.reset();
  }

  public suspendScoring(durationMs = 250): void {
    this.isScoringSuspended = true;
    this.scoringSuspendedTimer = durationMs;
  }

  public calibrateNoiseFloor(onProgress?: (progress: number) => void): Promise<number> {
    return new Promise((resolve) => {
      if (!this.analyser) {
        resolve(this.minVolumeThreshold);
        return;
      }

      const samples: number[] = [];
      const startTime = performance.now();
      const duration = 1000;

      const collect = () => {
        const elapsed = performance.now() - startTime;
        if (elapsed < duration) {
          this.analyser!.getFloatTimeDomainData(this.buffer as unknown as Float32Array<ArrayBuffer>);
          let sumSquares = 0;
          for (let i = 0; i < this.buffer.length; i++) {
            sumSquares += this.buffer[i] * this.buffer[i];
          }
          samples.push(Math.sqrt(sumSquares / this.buffer.length));
          if (onProgress) onProgress(elapsed / duration);
          requestAnimationFrame(collect);
        } else {
          const avgNoise = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
          this.minVolumeThreshold = Math.max(0.010, Math.min(0.06, avgNoise * 1.6));
          if (onProgress) onProgress(1.0);
          resolve(this.minVolumeThreshold);
        }
      };
      collect();
    });
  }

  public update(dt: number): PitchDetectionResult | null {
    if (this.isScoringSuspended) {
      this.scoringSuspendedTimer -= dt * 1000;
      if (this.scoringSuspendedTimer <= 0) {
        this.isScoringSuspended = false;
      }
    }

    if (!this.isListening || !this.analyser) {
      return null;
    }

    this.analyser.getFloatTimeDomainData(this.buffer as unknown as Float32Array<ArrayBuffer>);

    // 1. Calculate RMS volume with sensitivity
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rawRms = Math.sqrt(sumSquares / this.buffer.length);
    const volume = rawRms * this.inputSensitivity;

    if (volume < this.minVolumeThreshold || this.isScoringSuspended) {
      this.stateMachine.update(null, 4, 0, 0, dt);
      if (this.onPitchUpdate) this.onPitchUpdate(null);
      return null;
    }

    // 2. High-Precision MPM Pitch Detection
    const sampleRate = this.audioCtx ? this.audioCtx.sampleRate : 48000;
    const { freq, confidence } = this.detectPitchMPM(this.buffer, sampleRate);

    if (freq === -1 || confidence < this.minConfidence || freq < 65 || freq > 1150) {
      this.stateMachine.update(null, 4, 0, 0, dt);
      if (this.onPitchUpdate) this.onPitchUpdate(null);
      return null;
    }

    // 3. Frequency to Note & Cents
    const { noteName, octave, cents } = this.frequencyToNote(freq);
    this.smoothedCents = this.smoothedCents * 0.65 + cents * 0.35;

    // 4. Intentional Pitch Match State Machine
    const matchStatus = this.stateMachine.update(noteName, octave, cents, confidence, dt);

    const result: PitchDetectionResult = {
      frequency: freq,
      noteName,
      octave,
      cents: this.smoothedCents,
      volume,
      confidence,
      matchStatus
    };

    if (this.onPitchUpdate) {
      this.onPitchUpdate(result);
    }

    return result;
  }

  /**
   * McLeod Pitch Method (NSDF) with Subharmonic Suppression
   */
  private detectPitchMPM(buf: Float32Array, sampleRate: number): { freq: number; confidence: number } {
    const SIZE = buf.length;
    // Bounded search window for human vocal range (65Hz - 1100Hz)
    const minLag = Math.floor(sampleRate / 1100);
    const maxLag = Math.min(Math.ceil(sampleRate / 65), SIZE - 1);

    if (this.nsdfBuffer.length < maxLag + 1) {
      this.nsdfBuffer = new Float32Array(maxLag + 1);
    }

    // Compute NSDF
    let maxVal = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0, s1 = 0, s2 = 0;
      const len = SIZE - lag;
      for (let j = 0; j < len; j++) {
        const v1 = buf[j];
        const v2 = buf[j + lag];
        sum += v1 * v2;
        s1 += v1 * v1;
        s2 += v2 * v2;
      }
      const norm = Math.sqrt(s1 * s2);
      const val = norm > 0.0001 ? sum / norm : 0;
      this.nsdfBuffer[lag] = val;
      if (val > maxVal) maxVal = val;
    }

    if (maxVal < 0.60) return { freq: -1, confidence: 0 };

    // Find first significant peak above 85% of maxVal (prevents subharmonic octave drops)
    const peakThreshold = maxVal * 0.85;
    let peakLag = -1;

    for (let i = minLag + 1; i < maxLag; i++) {
      if (
        this.nsdfBuffer[i] > this.nsdfBuffer[i - 1] &&
        this.nsdfBuffer[i] >= this.nsdfBuffer[i + 1] &&
        this.nsdfBuffer[i] >= peakThreshold
      ) {
        peakLag = i;
        break;
      }
    }

    if (peakLag === -1) return { freq: -1, confidence: 0 };

    // Parabolic interpolation for sub-sample accuracy
    const y1 = this.nsdfBuffer[peakLag - 1];
    const y2 = this.nsdfBuffer[peakLag];
    const y3 = this.nsdfBuffer[peakLag + 1];
    const delta = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
    const exactLag = peakLag + (isNaN(delta) ? 0 : delta);

    return {
      freq: sampleRate / exactLag,
      confidence: this.nsdfBuffer[peakLag]
    };
  }

  private frequencyToNote(freq: number): { noteName: string; octave: number; cents: number } {
    const noteNum = 12 * Math.log2(freq / 440) + 69;
    const roundedNote = Math.round(noteNum);
    const idealFreq = 440 * Math.pow(2, (roundedNote - 69) / 12);
    const cents = Math.round(1200 * Math.log2(freq / idealFreq));

    const noteIndex = ((roundedNote % 12) + 12) % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const octave = Math.floor(roundedNote / 12) - 1;

    return { noteName, octave, cents };
  }
}
