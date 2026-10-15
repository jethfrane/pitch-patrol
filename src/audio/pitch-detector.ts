import { PitchMatchStateMachine, StateMachineStatus } from './pitch-match-state-machine';
import { analyzePitch, frequencyToNote } from './pitch-analysis';
export { NOTE_NAMES } from './pitch-analysis';
export function normalizeNoteName(name: string): string {
  const map: Record<string, string> = { DB: 'C♯', 'D♭': 'C♯', EB: 'D♯', 'E♭': 'D♯', GB: 'F♯', 'G♭': 'F♯', AB: 'G♯', 'A♭': 'G♯', BB: 'A♯', 'B♭': 'A♯' };
  return map[name.trim().toUpperCase()] || name.trim().toUpperCase().replace('#', '♯');
}
export interface PitchDetectionResult {
  frequency: number; noteName: string; octave: number; cents: number; volume: number; confidence: number; matchStatus: StateMachineStatus;
}
export interface InputStatus {
  message: string; device: string; level: number; threshold: number; confidence: number; frequency: number;
  settings: MediaTrackSettings | null; connected: boolean;
}
export class PitchDetector {
  public audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private buffer = new Float32Array(2048);
  private correlations = new Float32Array(2048);
  public isListening = false;
  public minVolumeThreshold = 0.003;
  public inputSensitivity = 1;
  public minConfidence = 0.80;
  public isScoringSuspended = false;
  private scoringUntil = 0;
  private calibrationActive = false;
  private openGate = false;
  private smoothedCents = 0;
  private previousNote = '';
  private lastAnalysis = 0;
  private requestVersion = 0;
  private connecting: Promise<boolean> | null = null;
  public selectedDeviceId = '';
  public status: InputStatus = { message: 'Connect your microphone', device: 'No microphone connected', level: 0, threshold: 0.003, confidence: 0, frequency: 0, settings: null, connected: false };
  public stateMachine = new PitchMatchStateMachine();
  public onAttackAuthorized?: (note: string, octave: number) => void;
  public onPitchUpdate?: (result: PitchDetectionResult | null) => void;
  public onInputInterrupted?: () => void;
  constructor() {
    this.stateMachine.onAttackAuthorized = (note, octave) => {
      if (!this.isScoringSuspended && !this.calibrationActive) this.onAttackAuthorized?.(note, octave);
    };
    navigator.mediaDevices?.addEventListener('devicechange', async () => {
      if (!this.isListening) return;
      const devices = await this.listDevices();
      const actual = this.status.settings?.deviceId;
      if (actual && !devices.some(d => d.deviceId === actual)) this.interrupted('Microphone disconnected. Select an input to reconnect.');
    });
  }
  public async listDevices(): Promise<MediaDeviceInfo[]> {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch { return []; }
  }
  public initMic(deviceId = this.selectedDeviceId): Promise<boolean> {
    if (this.isListening && (!deviceId || deviceId === this.status.settings?.deviceId)) return Promise.resolve(true);
    if (this.connecting) return this.connecting;
    const pending = this.connect(deviceId).finally(() => { if (this.connecting === pending) this.connecting = null; });
    this.connecting = pending;
    return pending;
  }
  private async connect(deviceId: string): Promise<boolean> {
    this.stopMic();
    const version = ++this.requestVersion;
    this.status.message = 'Waiting for microphone permission…';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone needs HTTPS and a supported browser.');
      const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx ??= new AudioCtor();
      await this.audioCtx.resume();
      const supported = navigator.mediaDevices.getSupportedConstraints();
      const audio: MediaTrackConstraints = { channelCount: { ideal: 1 } };
      if (supported.autoGainControl) audio.autoGainControl = false;
      if (supported.noiseSuppression) audio.noiseSuppression = false;
      if (supported.echoCancellation) audio.echoCancellation = false;
      if (deviceId) audio.deviceId = { exact: deviceId };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      if (version !== this.requestVersion) { stream.getTracks().forEach(t => t.stop()); return false; }
      this.micStream = stream;
      const track = stream.getAudioTracks()[0];
      this.status.settings = track.getSettings();
      this.selectedDeviceId = this.status.settings.deviceId || deviceId;
      this.status.device = track.label || 'Microphone';
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0;
      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);
      this.isListening = this.status.connected = true;
      this.status.message = 'Listening — hum a comfortable note';
      track.onended = () => this.interrupted('Microphone disconnected. Reconnect to continue.');
      track.onmute = () => { this.stateMachine.reset(); this.status.message = 'Microphone interrupted'; this.onInputInterrupted?.(); };
      track.onunmute = () => { this.status.message = 'Listening — resume when ready'; this.stateMachine.reset(); };
      return true;
    } catch (error) {
      if (version !== this.requestVersion) return false;
      const name = error instanceof DOMException ? error.name : '';
      this.status.message = name === 'NotAllowedError' ? 'Microphone blocked. Allow access in browser settings, then reconnect.' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'Selected microphone unavailable. Choose another input.' : error instanceof Error ? error.message : 'Microphone unavailable';
      return false;
    }
  }
  private interrupted(message: string) { this.stopMic(); this.status.message = message; this.onInputInterrupted?.(); }
  public stopMic() {
    ++this.requestVersion;
    this.micStream?.getTracks().forEach(track => { track.onended = null; track.onmute = null; track.onunmute = null; track.stop(); });
    this.micStream = null;
    this.sourceNode?.disconnect(); this.sourceNode = null;
    this.analyser?.disconnect(); this.analyser = null;
    this.isListening = this.status.connected = false;
    this.openGate = false; this.status.level = 0; this.status.frequency = 0;
    this.status.message = 'Microphone off';
    this.stateMachine.reset(); this.onPitchUpdate?.(null);
  }
  public suspendScoring(durationMs = 250) { this.scoringUntil = Math.max(this.scoringUntil, performance.now() + durationMs); this.isScoringSuspended = true; this.stateMachine.reset(); }
  public async calibrateNoiseFloor(onProgress?: (p: number) => void): Promise<number> {
    if (!this.analyser) return this.minVolumeThreshold;
    const analyser = this.analyser;
    const values: number[] = [];
    this.calibrationActive = true; this.stateMachine.reset();
    try {
      const started = performance.now();
      while (performance.now() - started < 1100 && analyser === this.analyser) {
        analyser.getFloatTimeDomainData(this.buffer as Float32Array<ArrayBuffer>);
        let sum = 0; for (const v of this.buffer) sum += v * v;
        values.push(Math.sqrt(sum / this.buffer.length));
        onProgress?.(Math.min(1, (performance.now() - started) / 1100));
        await new Promise(resolve => setTimeout(resolve, 35));
      }
      if (analyser !== this.analyser) return this.minVolumeThreshold;
      values.sort((a,b) => a-b);
      const noise = values[Math.floor(values.length * 0.7)] || 0.001;
      this.minVolumeThreshold = Math.max(0.001, Math.min(0.035, noise * 2.2));
      this.status.message = noise > 0.015 ? 'Background is loud. Move closer or use a quieter room.' : 'Calibrated — try a steady hum';
      onProgress?.(1);
      return this.minVolumeThreshold;
    } finally { this.calibrationActive = false; this.stateMachine.reset(); }
  }
  public update(_dt: number): PitchDetectionResult | null {
    const now = performance.now();
    if (!this.isListening || !this.analyser || !this.audioCtx) return null;
    if (now - this.lastAnalysis < 32) return null; // analyze at ~30 Hz, independent of render speed
    const elapsed = (now - this.lastAnalysis) / 1000;
    this.lastAnalysis = now;
    if (elapsed > 0.15) this.stateMachine.reset(); // stale buffers cannot earn hold progress
    const dt = Math.min(elapsed, 0.05);
    this.isScoringSuspended = now < this.scoringUntil;
    this.analyser.getFloatTimeDomainData(this.buffer as Float32Array<ArrayBuffer>);
    let sum = 0; for (const v of this.buffer) sum += v * v;
    const rms = Math.sqrt(sum / this.buffer.length);
    const gate = this.minVolumeThreshold / this.inputSensitivity;
    this.status.level = rms; this.status.threshold = gate;
    this.status.frequency = 0; this.status.confidence = 0;
    this.openGate = rms >= gate * (this.openGate ? 0.72 : 1);
    const invalid = (message: string) => {
      this.status.message = message;
      this.stateMachine.update(null, 4, 0, 0, dt); this.onPitchUpdate?.(null); return null;
    };
    if (this.audioCtx.state !== 'running') return invalid('Audio paused. Reconnect microphone.');
    if (this.calibrationActive) return invalid('Stay quiet — measuring room noise');
    if (this.isScoringSuspended) return invalid('Listening after game sound…');
    if (!this.openGate) return invalid('Input too quiet — move closer or adjust sensitivity');
    const analysis = analyzePitch(this.buffer, this.audioCtx.sampleRate, this.correlations);
    this.status.confidence = analysis.confidence;
    if (analysis.frequency < 65 || analysis.frequency > 1100 || analysis.confidence < this.minConfidence) return invalid('No clear pitch — try a steady hum');
    this.status.frequency = analysis.frequency;
    const note = frequencyToNote(analysis.frequency);
    const label = note.noteName + note.octave;
    this.smoothedCents = label !== this.previousNote ? note.cents : this.smoothedCents * 0.55 + note.cents * 0.45;
    this.previousNote = label;
    const matchStatus = this.stateMachine.update(note.noteName, note.octave, note.cents, analysis.confidence, dt);
    this.status.message = matchStatus.inTune ? 'Hold steady to fire' : note.cents < 0 ? 'Slightly flat — raise your pitch' : 'Slightly sharp — lower your pitch';
    const result = { ...note, cents: this.smoothedCents, frequency: analysis.frequency, confidence: analysis.confidence, volume: rms, matchStatus };
    this.onPitchUpdate?.(result); return result;
  }
}
