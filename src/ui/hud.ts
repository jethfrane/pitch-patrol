import { soundSynth } from '../audio/sound-synth';
import { PitchDetectionResult, InputStatus } from '../audio/pitch-detector';
import { PitchMatchStateMachine } from '../audio/pitch-match-state-machine';
export type GameInputMode = 'mic' | 'piano';
export interface HUDCallbacks {
  onEndGame: () => void; onStartGame: () => void; onRestartGame: () => void; onTogglePause: () => void;
  onToggleMic: (deviceId?: string) => Promise<boolean>;
  onCalibrateNoise: (progress: (p: number) => void) => Promise<number>;
  onListDevices: () => Promise<MediaDeviceInfo[]>;
  onPianoAttack: (note: string) => void;
  onPianoNoteDown: (note: string, octave?: number) => void; onPianoNoteUp: (note: string, octave?: number) => void;
  onChangeInputMode: (mode: GameInputMode) => void;
  onUpdateTolerance: (cents: number) => void; onUpdateSensitivity: (mult: number) => void;
  onToggleReducedMotion: (enabled: boolean) => void; onPracticeChange: (practice: boolean) => void;
  onReference: (note: string) => void; onOpenSettings: () => void;
}
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const keys = [ ['C','a',0],['C♯','w',0],['D','s',1],['D♯','e',1],['E','d',2],['F','f',3],['F♯','t',3],['G','g',4],['G♯','y',4],['A','h',5],['A♯','u',5],['B','j',6],['C','k',7] ] as const;
const keyMap = new Map<string, {note: string; octave: number}>(keys.map(([note,key,index]) => [key, { note, octave: index === 7 ? 5 : 4 }]));
export class HUD {
  public currentMode: GameInputMode = 'mic';
  private held = new Map<string, {note: string; octave: number}>();
  private matcher = new PitchMatchStateMachine({ requiredHoldMs: 320 });
  private currentTarget: string | null = null;
  private active = false;
  private bannerTimer = 0;
  private lastDiagnostics = 0;
  constructor(private container: HTMLElement, private callbacks: HUDCallbacks) {
    this.build(); this.events();
    this.matcher.onAttackAuthorized = note => { if (this.currentMode === 'piano' && this.active) callbacks.onPianoAttack(note); };
  }
  private build() {
    this.container.innerHTML = `
      <header id="top-hud" class="top-bar">
        <a class="game-brand" href="https://jethrofrane.xyz/work/pitch-patrol" target="_blank" rel="noopener"><img src="/icon.svg" width="34" height="34" alt=""><span>pitch<span class="brand-light">patrol</span></span></a>
        <div class="health-card"><span aria-hidden="true">♥</span><div class="health-bar-track"><div id="health-bar-fill" class="health-bar-fill"></div></div><span id="health-value">100</span><span class="sr-only">health points</span></div>
        <div class="run-stats"><span><small>WAVE</small><b id="hud-wave">01</b></span><span><small>TIME</small><b id="hud-timer">00:00</b></span><span><small>SCORE</small><b id="hud-score">0</b></span><b id="hud-combo" class="combo-badge">×1.0</b></div>
        <div class="hud-actions"><button id="btn-sound" class="hud-btn" aria-label="Enable sound">Sound off</button><button id="btn-settings" class="hud-btn" aria-label="Input and game settings">Settings</button><button id="btn-pause" class="hud-btn" aria-label="Pause game">Ⅱ</button></div>
      </header>
      <div id="wave-banner" class="wave-banner hidden"><span id="wave-banner-sub">MELODY GARDEN</span><h2 id="wave-banner-title">Wave 01</h2></div>
      <section id="bottom-hud" class="bottom-bar">
        <div class="mode-switcher"><button id="tab-mic" class="mode-tab active">Vocal</button><button id="tab-piano" class="mode-tab">Piano</button><span id="session-label" class="session-label">Survival · any octave</span><button id="btn-reference" class="mini-btn hidden">Hear target</button></div>
        <div id="mic-hud-section" class="tuner-row"><div class="target-card"><span class="card-caption">NEXT THREAT</span><strong id="target-note-badge" class="note-pill">—</strong></div><div class="gauge-card"><div class="gauge-labels"><span>FLAT</span><span id="tune-status">Connect your microphone</span><span>SHARP</span></div><div class="gauge-track"><div class="center-target-line"></div><div id="tuning-needle" class="gauge-needle"></div></div><div class="hold-progress-track"><div id="hold-progress-fill" class="hold-progress-fill"></div></div><p id="input-message" class="input-message">A steady note charges your attack.</p></div><div class="detected-card"><span class="card-caption">YOUR NOTE</span><strong id="detected-note-badge" class="note-pill detected-pill">—</strong></div><button id="btn-mic-toggle" class="mic-btn">Connect mic</button></div>
        <div id="piano-hud-section" class="piano-section hidden"><div class="piano-toolbar"><span id="piano-status">Hold one key steadily to fire.</span><button id="btn-toggle-labels" class="mini-btn">Note names: off</button><button id="btn-toggle-hints" class="mini-btn">Key hints: off</button></div><div class="piano-keyboard" id="piano-keyboard" role="group" aria-label="Piano keyboard">${keys.map(([note,key,index]) => `<button class="piano-key ${note.includes('♯') ? 'black' : 'white'}" style="--key-index:${index}" data-key="${key}" data-note="${note}" data-octave="${index === 7 ? 5 : 4}" aria-label="Play ${note}${index === 7 ? 5 : 4}"><span class="key-label">${note}</span><span class="key-hint">${key.toUpperCase()}</span></button>`).join('')}</div></div>
      </section>
      <div id="modal-start" class="modal-overlay"><section class="modal-card welcome-card" aria-labelledby="welcome-title"><img src="/icon.svg" class="welcome-icon" alt="Pitch Patrol logo" width="76" height="76"><div class="modal-badge">AN OPEN-SOURCE MUSIC EXPERIMENT</div><h1 id="welcome-title" class="modal-title">Find your note.<br><em>Defend the garden.</em></h1><p class="modal-subtitle">Hum a steady pitch to send a musical pulse toward the matching creature. A little listening. A little survival.</p><div class="setup-options"><label>Play with<select id="start-input"><option value="mic">Your microphone</option><option value="piano">On-screen piano</option></select></label><label>Session<select id="start-session"><option value="survival">Survival · 100 health</option><option value="practice">Practice · no damage</option></select></label></div><button id="btn-start" class="primary-btn">Enter Melody Garden <span aria-hidden="true">↗</span></button><p id="start-error" class="error-message" role="status"></p><div class="welcome-notes"><span>Headphones recommended</span><span>Audio stays on your device</span></div><p class="experiment-note">Astra medium for planning · Argon in Gemini Tasks for the prototype · Codex for release improvements. Experimental pitch practice, not a graded music assessment.</p><div class="welcome-links"><a href="https://github.com/jethfrane/pitch-patrol" target="_blank" rel="noopener">Source & feedback ↗</a><a href="https://jethrofrane.xyz/work/pitch-patrol" target="_blank" rel="noopener">The experiment ↗</a></div></section></div>
      <div id="modal-settings" class="modal-overlay hidden"><section class="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div class="modal-badge">MAKE YOURSELF HEARD</div><h2 id="settings-title">Input check</h2><p class="modal-subtitle">Connect, check your signal, then hum comfortably. Game pauses while settings are open.</p><label class="setting-item">Microphone<select id="select-device"><option value="">Default microphone</option></select></label><div class="input-check"><div class="meter-track"><div id="mic-meter-fill"></div></div><p id="device-label">No microphone connected</p><p id="settings-input-status" role="status">Connect your microphone to begin.</p><div class="inline-actions"><button id="btn-connect" class="secondary-btn">Connect / reconnect</button><button id="btn-calibrate" class="secondary-btn">Calibrate quiet room</button></div></div><label class="setting-item">Pitch tolerance<select id="select-tolerance"><option value="35">Standard · ±35 cents</option><option value="45">Beginner · ±45 cents</option><option value="25">Precise · ±25 cents</option></select></label><label class="setting-item">Sensitivity <span id="label-sensitivity">1.0×</span><input id="range-sensitivity" type="range" min="0.5" max="3" step="0.1" value="1"></label><label class="setting-item">Sound effects<input id="range-sfx-vol" type="range" min="0" max="1" step="0.05" value="0.25"></label><label class="setting-item">Piano volume<input id="range-piano-vol" type="range" min="0" max="1" step="0.05" value="0.7"></label><label class="setting-item">Reduced motion<input id="check-reduced-motion" type="checkbox"></label><details class="diagnostics"><summary>Input diagnostics</summary><p>Requested: automatic gain, noise suppression and echo cancellation off. Reported settings below may be unavailable; OS or hardware processing can remain.</p><pre id="input-diagnostics">No input yet.</pre></details><button id="btn-close-settings" class="primary-btn">Back to garden</button></section></div>
      <div id="modal-pause" class="modal-overlay hidden"><section class="modal-card compact-card"><div class="modal-badge">TAKE A BREATH</div><h2>Garden paused</h2><p id="pause-message">Your notes can wait.</p><button id="btn-resume" class="primary-btn">Resume</button><button id="btn-pause-settings" class="secondary-btn">Check microphone</button><button id="btn-end-session" class="secondary-btn">End session</button></section></div>
      <div id="modal-gameover" class="modal-overlay hidden"><section class="modal-card compact-card"><div class="modal-badge">ONE MORE MELODY?</div><h2>Patrol complete.</h2><div class="stats-grid"><div class="stat-card"><span>Score</span><b id="final-score">0</b></div><div class="stat-card"><span>Best in this mode</span><b id="best-score">0</b></div><div class="stat-card"><span>Wave reached</span><b id="final-wave">1</b></div><div class="stat-card"><span>Creatures harmonized</span><b id="final-hits">0</b></div></div><p class="experiment-note">Scores reflect this session and its settings. They are not a measure of singing ability.</p><button id="btn-retry" class="primary-btn">Play again</button><button id="btn-menu" class="secondary-btn">Change session</button></section></div>`;
  }
  private async connect(deviceId?: string) {
    $('btn-connect').textContent = 'Connecting…';
    const ok = await this.callbacks.onToggleMic(deviceId);
    $('btn-connect').textContent = 'Connect / reconnect';
    if (ok) {
      const devices = await this.callbacks.onListDevices();
      const select = $<HTMLSelectElement>('select-device');
      const previous = deviceId || select.value;
      select.replaceChildren(new Option('Default microphone', ''), ...devices.map((d,i) => new Option(d.label || `Microphone ${i+1}`, d.deviceId)));
      select.value = previous;
    }
    return ok;
  }
  private events() {
    $('btn-start').onclick = async () => {
      const button = $<HTMLButtonElement>('btn-start'); button.disabled = true; button.textContent = 'Getting ready…';
      soundSynth.initCtx();
      this.setMode($<HTMLSelectElement>('start-input').value as GameInputMode);
      if (this.currentMode === 'piano') { soundSynth.isMuted = false; $('btn-sound').textContent = 'Sound on'; }
      const practice = $<HTMLSelectElement>('start-session').value === 'practice';
      this.callbacks.onPracticeChange(practice);
      $('session-label').textContent = `${practice ? 'Practice' : 'Survival'} · any octave`;
      $('btn-reference').classList.toggle('hidden', !practice);
      if (this.currentMode === 'mic' && !await this.connect()) {
        $('start-error').textContent = 'Microphone unavailable. Check browser permission or choose the piano to try the game.';
        button.disabled = false; button.textContent = 'Try again'; return;
      }
      $('start-error').textContent = ''; $('modal-start').classList.add('hidden');
      button.disabled = false; button.textContent = 'Enter Melody Garden ↗'; this.callbacks.onStartGame();
    };
    $('btn-pause').onclick = $('btn-resume').onclick = () => this.callbacks.onTogglePause();
    const settings = () => { this.callbacks.onOpenSettings(); $('modal-settings').classList.remove('hidden'); };
    $('btn-settings').onclick = $('btn-pause-settings').onclick = settings;
    $('btn-close-settings').onclick = () => $('modal-settings').classList.add('hidden');
    $('btn-end-session').onclick = () => { $('modal-pause').classList.add('hidden'); this.callbacks.onEndGame(); };
    $('btn-retry').onclick = () => { $('modal-gameover').classList.add('hidden'); this.callbacks.onRestartGame(); };
    $('btn-menu').onclick = () => { $('modal-gameover').classList.add('hidden'); $('modal-start').classList.remove('hidden'); this.releaseKeys(); };
    $('btn-sound').onclick = () => { soundSynth.isMuted = !soundSynth.isMuted; $('btn-sound').textContent = soundSynth.isMuted ? 'Sound off' : 'Sound on'; $('btn-sound').setAttribute('aria-label', soundSynth.isMuted ? 'Enable sound' : 'Mute sound'); if (soundSynth.isMuted) soundSynth.releaseAllPianoNotes(); };
    $('btn-mic-toggle').onclick = () => { settings(); void this.connect(); };
    $('btn-connect').onclick = () => void this.connect($<HTMLSelectElement>('select-device').value);
    $<HTMLSelectElement>('select-device').onchange = () => void this.connect($<HTMLSelectElement>('select-device').value);
    $('btn-calibrate').onclick = async () => {
      const button = $<HTMLButtonElement>('btn-calibrate'); button.disabled = true;
      try { if (await this.connect()) await this.callbacks.onCalibrateNoise(p => { button.textContent = `Stay quiet… ${Math.round(p * 100)}%`; }); }
      finally { button.disabled = false; button.textContent = 'Calibrate quiet room'; }
    };
    $('tab-mic').onclick = async () => { this.callbacks.onOpenSettings(); this.setMode('mic'); await this.connect(); };
    $('tab-piano').onclick = () => { this.callbacks.onOpenSettings(); this.setMode('piano'); soundSynth.isMuted = false; $('btn-sound').textContent = 'Sound on'; soundSynth.initCtx(); };
    $('btn-toggle-labels').onclick = () => { const on = $('piano-hud-section').classList.toggle('show-labels'); $('btn-toggle-labels').textContent = `Note names: ${on ? 'on' : 'off'}`; };
    $('btn-toggle-hints').onclick = () => { const on = $('piano-hud-section').classList.toggle('show-hints'); $('btn-toggle-hints').textContent = `Key hints: ${on ? 'on' : 'off'}`; };
    $('btn-reference').onclick = () => { if (this.currentTarget) this.callbacks.onReference(this.currentTarget); };
    $<HTMLSelectElement>('select-tolerance').onchange = () => { const value = +$<HTMLSelectElement>('select-tolerance').value; this.matcher.setTolerance(value); this.callbacks.onUpdateTolerance(value); };
    $<HTMLInputElement>('range-sensitivity').oninput = () => { const value = +$<HTMLInputElement>('range-sensitivity').value; $('label-sensitivity').textContent = `${value.toFixed(1)}×`; this.callbacks.onUpdateSensitivity(value); };
    $<HTMLInputElement>('range-sfx-vol').oninput = () => soundSynth.sfxVolume = +$<HTMLInputElement>('range-sfx-vol').value;
    $<HTMLInputElement>('range-piano-vol').oninput = () => soundSynth.pianoVolume = +$<HTMLInputElement>('range-piano-vol').value;
    $<HTMLInputElement>('check-reduced-motion').onchange = () => this.callbacks.onToggleReducedMotion($<HTMLInputElement>('check-reduced-motion').checked);
    document.querySelectorAll<HTMLElement>('.piano-key').forEach(key => {
      key.onpointerdown = e => { if (this.currentMode !== 'piano') return; e.preventDefault(); key.setPointerCapture(e.pointerId); this.down(`p${e.pointerId}`, key.dataset.note!, +key.dataset.octave!); };
      key.onpointerup = key.onpointercancel = e => { this.up(`p${e.pointerId}`); };
      key.onlostpointercapture = e => this.up(`p${e.pointerId}`);
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (!$('modal-settings').classList.contains('hidden')) $('modal-settings').classList.add('hidden'); else this.callbacks.onTogglePause(); return; }
      if (this.currentMode !== 'piano' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return;
      const data = keyMap.get(e.key.toLowerCase());
      if (data) { e.preventDefault(); this.down(e.key.toLowerCase(), data.note, data.octave); }
    });
    window.addEventListener('keyup', e => this.up(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.releaseKeys());
  }
  private setMode(mode: GameInputMode) {
    this.releaseKeys(); this.currentMode = mode;
    $('tab-mic').classList.toggle('active', mode === 'mic'); $('tab-piano').classList.toggle('active', mode === 'piano');
    $('mic-hud-section').classList.toggle('hidden', mode !== 'mic'); $('piano-hud-section').classList.toggle('hidden', mode !== 'piano');
    document.body.dataset.mode = mode; this.callbacks.onChangeInputMode(mode);
  }
  private down(source: string, note: string, octave: number) {
    if (this.held.has(source)) return;
    this.held.set(source, {note, octave}); this.matcher.reset();
    this.callbacks.onPianoNoteDown(note, octave); this.paintKeys();
  }
  private up(source: string) {
    const data = this.held.get(source); if (!data) return;
    this.held.delete(source); this.matcher.reset();
    if (![...this.held.values()].some(v => v.note === data.note && v.octave === data.octave)) this.callbacks.onPianoNoteUp(data.note, data.octave);
    this.paintKeys();
  }
  private paintKeys() { document.querySelectorAll<HTMLElement>('.piano-key').forEach(el => el.classList.toggle('active', [...this.held.values()].some(v => v.note === el.dataset.note && v.octave === +el.dataset.octave!))); }
  public releaseKeys() { this.held.clear(); this.matcher.reset(); soundSynth.releaseAllPianoNotes(); this.paintKeys(); }
  public setPlaying(playing: boolean) { this.active = playing; if (!playing) this.releaseKeys(); }
  public updatePiano(dt: number) {
    if (this.currentMode !== 'piano' || !this.active) return;
    const valid = this.held.size === 1 ? [...this.held.values()][0] : null;
    const result = this.matcher.update(valid?.note || null, valid?.octave || 4, 0, valid ? 1 : 0, dt);
    $('piano-status').textContent = this.held.size > 1 ? 'One note at a time — release the extra keys.' : valid ? `${valid.note} · hold ${Math.round(result.holdProgress * 100)}%` : `Target ${this.currentTarget || '—'} · hold one key steadily`;
  }
  public updateInputStatus(status: InputStatus) {
    if (performance.now() - this.lastDiagnostics < 100) return; this.lastDiagnostics = performance.now();
    $('input-message').textContent = status.message; $('settings-input-status').textContent = status.message;
    $('device-label').textContent = status.device; $('btn-mic-toggle').textContent = status.connected ? 'Mic input' : 'Connect mic';
    $('mic-meter-fill').style.width = `${Math.min(100, Math.sqrt(status.level) * 280)}%`;
    const s = status.settings;
    const setting = (v: boolean | undefined) => v === undefined ? 'unavailable' : v ? 'on' : 'off';
    $('input-diagnostics').textContent = `Raw level: ${status.level.toFixed(4)}\nGate: ${status.threshold.toFixed(4)}\nConfidence: ${(status.confidence * 100).toFixed(0)}%\nFrequency: ${status.frequency.toFixed(1)} Hz\nSample rate: ${s?.sampleRate || 'unavailable'}\nAutomatic gain: ${setting(s?.autoGainControl)}\nNoise suppression: ${setting(s?.noiseSuppression)}\nEcho cancellation: ${setting(s?.echoCancellation)}`;
  }
  public updateHealth(hp: number, max: number) { $('health-bar-fill').style.width = `${hp/max*100}%`; $('health-value').textContent = `${Math.ceil(hp)}`; }
  public updateScore(score: number, combo: number) { $('hud-score').textContent = score.toLocaleString(); $('hud-combo').textContent = `×${combo.toFixed(1)}`; }
  public updateWave(wave: number) { $('hud-wave').textContent = String(wave).padStart(2,'0'); }
  public updateTimer(seconds: number) { $('hud-timer').textContent = `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`; }
  public setTargetNote(note: string | null) { this.currentTarget = note; $('target-note-badge').textContent = note || '—'; }
  public updatePitchDisplay(result: PitchDetectionResult | null) {
    $('detected-note-badge').textContent = result ? `${result.noteName}${result.octave}` : '—';
    $('tuning-needle').style.left = `${50 + (result ? Math.max(-50,Math.min(50,result.cents)) : 0)}%`;
    $('hold-progress-fill').style.width = `${(result?.matchStatus.holdProgress || 0)*100}%`;
    $('tune-status').textContent = result ? `${Math.round(result.cents)>0 ? '+' : ''}${Math.round(result.cents)} cents · ${result.matchStatus.inTune ? 'HOLD STEADY' : 'ADJUST PITCH'}` : 'LISTENING';
  }
  public showPause(show: boolean) { $('modal-pause').classList.toggle('hidden', !show); }
  public showWaveBanner(wave: number, title: string) { window.clearTimeout(this.bannerTimer); $('wave-banner-title').textContent = `Wave ${wave}`; $('wave-banner-sub').textContent = title; $('wave-banner').classList.remove('hidden'); this.bannerTimer = window.setTimeout(() => $('wave-banner').classList.add('hidden'), 1700); }
  public showGameOver(score: number, wave: number, best: number, hits: number) { this.setPlaying(false); $('final-score').textContent = score.toLocaleString(); $('best-score').textContent = best.toLocaleString(); $('final-wave').textContent = `${wave}`; $('final-hits').textContent = `${hits}`; $('modal-gameover').classList.remove('hidden'); }
}
