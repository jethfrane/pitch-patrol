import { soundSynth } from '../audio/sound-synth';
import { PitchDetectionResult, InputStatus } from '../audio/pitch-detector';
import { PitchMatchStateMachine } from '../audio/pitch-match-state-machine';

export type GameInputMode = 'mic' | 'piano';

export interface HUDCallbacks {
  onEndGame: () => void;
  onStartGame: () => void;
  onRestartGame: () => void;
  onTogglePause: () => void;
  onToggleMic: (deviceId?: string) => Promise<boolean>;
  onCalibrateNoise: (progress: (p: number) => void) => Promise<number>;
  onListDevices: () => Promise<MediaDeviceInfo[]>;
  onPianoAttack: (note: string) => void;
  onPianoNoteDown: (note: string, octave?: number) => void;
  onPianoNoteUp: (note: string, octave?: number) => void;
  onChangeInputMode: (mode: GameInputMode) => void;
  onUpdateTolerance: (cents: number) => void;
  onUpdateSensitivity: (mult: number) => void;
  onToggleEchoFilter: (enabled: boolean) => void;
  onResetAudioSession: () => void;
  onActivateNova: () => void;
  onToggleReducedMotion: (enabled: boolean) => void;
  onPracticeChange: (practice: boolean) => void;
  onReference: (note: string) => void;
  onOpenSettings: () => void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const KEYS = [
  ['C', 'a', 0], ['C♯', 'w', 0], ['D', 's', 1], ['D♯', 'e', 1], ['E', 'd', 2],
  ['F', 'f', 3], ['F♯', 't', 3], ['G', 'g', 4], ['G♯', 'y', 4], ['A', 'h', 5],
  ['A♯', 'u', 5], ['B', 'j', 6], ['C', 'k', 7]
] as const;

const KEY_MAP = new Map<string, { note: string; octave: number }>(
  KEYS.map(([note, key, index]) => [key, { note, octave: index === 7 ? 5 : 4 }])
);

const ICONS = {
  soundOn: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  soundOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  pause: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.5"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5"/></svg>`,
  mic: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`,
  piano: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="7.5" y1="4" x2="7.5" y2="14"/><line x1="12" y1="4" x2="12" y2="14"/><line x1="16.5" y1="4" x2="16.5" y2="14"/><line x1="9" y1="14" x2="9" y2="20"/><line x1="15" y1="14" x2="15" y2="20"/></svg>`,
  nova: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/></svg>`,
  ear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
};

export class HUD {
  public currentMode: GameInputMode = 'mic';
  private held = new Map<string, { note: string; octave: number }>();
  private matcher = new PitchMatchStateMachine({ requiredHoldMs: 280 });
  private currentTarget: string | null = null;
  private active = false;
  private bannerTimer = 0;
  private lastDiagnostics = 0;
  private activePianoHoldProgress = 0;

  constructor(private container: HTMLElement, private callbacks: HUDCallbacks) {
    this.build();
    this.events();
    this.matcher.onAttackAuthorized = note => {
      if (this.currentMode === 'piano' && this.active) callbacks.onPianoAttack(note);
    };
  }

  private build() {
    this.container.innerHTML = `
      <header id="top-hud" class="top-bar">
        <a class="game-brand" href="https://jethrofrane.xyz/work/pitch-patrol" target="_blank" rel="noopener">
          <img src="/icon.svg" width="32" height="32" alt="">
          <span>pitch<span class="brand-light">patrol</span></span>
        </a>
        <div class="health-card" aria-label="Guardian health">
          <span aria-hidden="true">♥</span>
          <div class="health-bar-track"><div id="health-bar-fill" class="health-bar-fill"></div></div>
          <span id="health-value">100</span>
          <span class="sr-only">health points</span>
        </div>
        <div class="run-stats">
          <span><small>WAVE</small><b id="hud-wave">01</b></span>
          <span class="stat-time"><small>TIME</small><b id="hud-timer">00:00</b></span>
          <span><small>SCORE</small><b id="hud-score">0</b></span>
          <b id="hud-combo" class="combo-badge">×1.0</b>
        </div>
        <div class="hud-actions">
          <button id="btn-sound" class="hud-btn icon-btn" aria-label="Enable sound" title="Toggle sound">${ICONS.soundOff}<span class="btn-label">Sound off</span></button>
          <button id="btn-settings" class="hud-btn icon-btn" aria-label="Input and game settings" title="Settings">${ICONS.settings}<span class="btn-label">Settings</span></button>
          <button id="btn-pause" class="hud-btn icon-btn" aria-label="Pause game" title="Pause">${ICONS.pause}</button>
        </div>
      </header>

      <div id="wave-banner" class="wave-banner hidden">
        <span id="wave-banner-sub">MELODY GARDEN</span>
        <h2 id="wave-banner-title">Wave 01</h2>
      </div>

      <section id="bottom-hud" class="bottom-bar">
        <div class="mode-switcher">
          <button id="tab-mic" class="mode-tab active">Vocal</button>
          <button id="tab-piano" class="mode-tab">Piano</button>
          <span id="session-label" class="session-label">Survival · any octave</span>
          <button id="btn-nova" class="nova-btn" disabled title="Harmonic Nova (Space)">
            <span id="nova-fill" class="nova-fill"></span>
            <span class="nova-content">${ICONS.nova}<span id="nova-text">NOVA 0%</span></span>
          </button>
          <button id="btn-reference" class="mini-btn ref-btn hidden">${ICONS.ear}<span>Hear</span></button>
        </div>

        <div id="mic-hud-section" class="tuner-row">
          <div class="target-card">
            <span class="card-caption">TARGET</span>
            <strong id="target-note-badge" class="note-pill">—</strong>
          </div>
          <div class="gauge-card">
            <div class="gauge-labels">
              <span>FLAT</span>
              <span id="tune-status">Connect your microphone</span>
              <span>SHARP</span>
            </div>
            <div class="gauge-track">
              <div class="center-target-line"></div>
              <div id="tuning-needle" class="gauge-needle"></div>
            </div>
            <div class="hold-progress-track"><div id="hold-progress-fill" class="hold-progress-fill"></div></div>
            <p id="input-message" class="input-message">A steady note charges your attack.</p>
          </div>
          <div class="detected-card">
            <span class="card-caption">YOU</span>
            <strong id="detected-note-badge" class="note-pill detected-pill">—</strong>
          </div>
          <button id="btn-mic-toggle" class="mic-btn">Mic</button>
        </div>

        <div id="piano-hud-section" class="piano-section show-labels hidden">
          <div class="piano-toolbar">
            <span id="piano-status">Hold one key steadily to fire.</span>
            <button id="btn-toggle-labels" class="mini-btn">Notes: on</button>
            <button id="btn-toggle-hints" class="mini-btn desktop-only-btn">Keys: off</button>
          </div>
          <div class="hold-progress-track piano-hold-track"><div id="piano-hold-fill" class="hold-progress-fill"></div></div>
          <div class="piano-keyboard" id="piano-keyboard" role="group" aria-label="Piano keyboard">
            ${KEYS.map(([note, key, index]) => `
              <button class="piano-key ${note.includes('♯') ? 'black' : 'white'}"
                style="--key-index:${index}"
                data-key="${key}"
                data-note="${note}"
                data-octave="${index === 7 ? 5 : 4}"
                aria-label="Play ${note}${index === 7 ? 5 : 4}">
                <span class="key-label">${note}</span>
                <span class="key-hint">${key.toUpperCase()}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </section>

      <div id="modal-start" class="modal-overlay">
        <section class="modal-card welcome-card" aria-labelledby="welcome-title">
          <div class="welcome-header">
            <img src="/icon.svg" class="welcome-icon" alt="Pitch Patrol logo" width="60" height="60">
            <div>
              <div class="modal-badge">OPEN-SOURCE 3D PITCH EXPERIMENT</div>
              <h1 id="welcome-title" class="modal-title">Find your note. <em>Defend the garden.</em></h1>
            </div>
          </div>
          <p class="modal-subtitle">Hum a steady pitch or play the keys to launch harmonic blasts, knock back waves, and charge your <strong>Harmonic Nova</strong>.</p>
          <div class="choice-row" role="group" aria-label="Play with">
            <button type="button" class="choice-btn active" data-input="mic">
              <span class="choice-icon">${ICONS.mic}</span>
              <b>Sing</b>
              <small>Use your voice</small>
            </button>
            <button type="button" class="choice-btn" data-input="piano">
              <span class="choice-icon">${ICONS.piano}</span>
              <b>Piano</b>
              <small>Tap or type keys</small>
            </button>
          </div>
          <label class="practice-toggle">
            <input type="checkbox" id="start-practice">
            <span><strong>Practice mode</strong> · no damage, includes Hear Target tone</span>
          </label>
          <select id="start-input" class="hidden"><option value="mic">mic</option><option value="piano">piano</option></select>
          <button id="btn-start" class="primary-btn">Enter Melody Garden <span aria-hidden="true">↗</span></button>
          <p id="start-error" class="error-message" role="status"></p>
          <div class="welcome-notes">
            <span>Works on mobile & desktop</span>
            <span>Headphones ideal for Sing</span>
            <span>Audio stays on your device</span>
          </div>
          <div class="welcome-links">
            <a href="https://github.com/jethfrane/pitch-patrol" target="_blank" rel="noopener">Source & feedback ↗</a>
            <a href="https://jethrofrane.xyz/work/pitch-patrol" target="_blank" rel="noopener">The experiment ↗</a>
          </div>
        </section>
      </div>

      <div id="modal-settings" class="modal-overlay hidden">
        <section class="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-badge">AUDIO & CONTROLS</div>
          <h2 id="settings-title">Input check</h2>
          <p class="modal-subtitle">Connect, test your signal, then hum comfortably. Audio switches back to media speaker automatically when you switch to Piano or end a run.</p>
          <label class="setting-item">Microphone<select id="select-device"><option value="">Default microphone</option></select></label>
          <div class="input-check">
            <div class="meter-track"><div id="mic-meter-fill"></div></div>
            <p id="device-label">No microphone connected</p>
            <p id="settings-input-status" role="status">Connect your microphone to begin.</p>
            <div class="inline-actions">
              <button id="btn-connect" class="secondary-btn">Connect / reconnect</button>
              <button id="btn-calibrate" class="secondary-btn">Calibrate room</button>
              <button id="btn-reset-audio" class="secondary-btn">Reset audio output</button>
            </div>
          </div>
          <label class="setting-item">Pitch tolerance
            <select id="select-tolerance">
              <option value="35">Standard · ±35 cents</option>
              <option value="45">Beginner · ±45 cents</option>
              <option value="25">Precise · ±25 cents</option>
            </select>
          </label>
          <label class="setting-item">Mic sensitivity <span id="label-sensitivity">1.0×</span>
            <input id="range-sensitivity" type="range" min="0.5" max="5" step="0.1" value="1">
          </label>
          <label class="setting-item">Sound effects<input id="range-sfx-vol" type="range" min="0" max="1" step="0.05" value="0.65"></label>
          <label class="setting-item">Piano volume<input id="range-piano-vol" type="range" min="0" max="1" step="0.05" value="0.85"></label>
          <label class="setting-item">Echo / call filter (speaker mode)<input id="check-echo-filter" type="checkbox"></label>
          <label class="setting-item">Reduced motion<input id="check-reduced-motion" type="checkbox"></label>
          <details class="diagnostics">
            <summary>Input diagnostics</summary>
            <p>Uses one shared Web Audio session with W3C AudioSession routing where supported.</p>
            <pre id="input-diagnostics">No input yet.</pre>
          </details>
          <button id="btn-close-settings" class="primary-btn">Back to garden</button>
        </section>
      </div>

      <div id="modal-pause" class="modal-overlay hidden">
        <section class="modal-card compact-card">
          <div class="modal-badge">TAKE A BREATH</div>
          <h2>Garden paused</h2>
          <p id="pause-message">Your notes can wait.</p>
          <button id="btn-resume" class="primary-btn">Resume</button>
          <button id="btn-pause-settings" class="secondary-btn">Audio & mic settings</button>
          <button id="btn-end-session" class="secondary-btn">End session</button>
        </section>
      </div>

      <div id="modal-gameover" class="modal-overlay hidden">
        <section class="modal-card compact-card">
          <div class="modal-badge">ONE MORE MELODY?</div>
          <h2>Patrol complete.</h2>
          <div class="stats-grid">
            <div class="stat-card"><span>Score</span><b id="final-score">0</b></div>
            <div class="stat-card"><span>Best in this mode</span><b id="best-score">0</b></div>
            <div class="stat-card"><span>Wave reached</span><b id="final-wave">1</b></div>
            <div class="stat-card"><span>Creatures harmonized</span><b id="final-hits">0</b></div>
          </div>
          <p class="experiment-note">Scores reflect this session and its settings. They are not a measure of singing ability.</p>
          <button id="btn-retry" class="primary-btn">Play again</button>
          <button id="btn-menu" class="secondary-btn">Change session</button>
        </section>
      </div>
    `;
  }

  private renderSoundButton(muted: boolean) {
    const btn = $('btn-sound');
    btn.innerHTML = `${muted ? ICONS.soundOff : ICONS.soundOn}<span class="btn-label">${muted ? 'Sound off' : 'Sound on'}</span>`;
    btn.setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
    btn.classList.toggle('active-sound', !muted);
  }

  private async connect(deviceId?: string) {
    $('btn-connect').textContent = 'Connecting…';
    const ok = await this.callbacks.onToggleMic(deviceId);
    $('btn-connect').textContent = 'Connect / reconnect';
    if (ok) {
      const devices = await this.callbacks.onListDevices();
      const select = $<HTMLSelectElement>('select-device');
      const previous = deviceId || select.value;
      select.replaceChildren(
        new Option('Default microphone', ''),
        ...devices.map((d, i) => new Option(d.label || `Microphone ${i + 1}`, d.deviceId))
      );
      select.value = previous;
    }
    return ok;
  }

  private events() {
    $('btn-start').onclick = async () => {
      const button = $<HTMLButtonElement>('btn-start');
      button.disabled = true;
      button.textContent = 'Getting ready…';

      const chosenMode = $<HTMLSelectElement>('start-input').value as GameInputMode;
      const practice = $<HTMLInputElement>('start-practice').checked;
      this.callbacks.onPracticeChange(practice);
      $('session-label').textContent = `${practice ? 'Practice' : 'Survival'} · any octave`;
      $('btn-reference').classList.toggle('hidden', !practice);

      // Initialize shared AudioContext directly inside the user gesture
      soundSynth.initCtx();
      this.setMode(chosenMode);
      if (chosenMode === 'piano') {
        soundSynth.setAudioSessionType('playback');
        soundSynth.isMuted = false;
        this.renderSoundButton(false);
      } else {
        soundSynth.isMuted = true;
        this.renderSoundButton(true);
      }

      if (chosenMode === 'mic' && !(await this.connect())) {
        $('start-error').textContent = 'Microphone unavailable. Check browser permission or switch to Piano to play right away.';
        button.disabled = false;
        button.textContent = 'Try again';
        return;
      }

      $('start-error').textContent = '';
      $('modal-start').classList.add('hidden');
      button.disabled = false;
      button.textContent = 'Enter Melody Garden ↗';
      this.callbacks.onStartGame();
    };

    document.querySelectorAll<HTMLButtonElement>('.choice-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.choice-btn').forEach(x => x.classList.toggle('active', x === btn));
        $<HTMLSelectElement>('start-input').value = btn.dataset.input!;
      };
    });

    $('btn-pause').onclick = $('btn-resume').onclick = () => this.callbacks.onTogglePause();

    const openSettings = () => {
      this.callbacks.onOpenSettings();
      $('modal-settings').classList.remove('hidden');
    };
    $('btn-settings').onclick = $('btn-pause-settings').onclick = openSettings;
    $('btn-close-settings').onclick = () => $('modal-settings').classList.add('hidden');
    $('btn-end-session').onclick = () => {
      $('modal-pause').classList.add('hidden');
      this.callbacks.onEndGame();
    };
    $('btn-retry').onclick = () => {
      $('modal-gameover').classList.add('hidden');
      this.callbacks.onRestartGame();
    };
    $('btn-menu').onclick = () => {
      $('modal-gameover').classList.add('hidden');
      $('modal-start').classList.remove('hidden');
      this.releaseKeys();
    };

    $('btn-sound').onclick = () => {
      soundSynth.initCtx();
      soundSynth.isMuted = !soundSynth.isMuted;
      this.renderSoundButton(soundSynth.isMuted);
      if (soundSynth.isMuted) soundSynth.releaseAllPianoNotes();
    };

    $('btn-nova').onclick = () => this.callbacks.onActivateNova();
    $('btn-mic-toggle').onclick = () => { openSettings(); void this.connect(); };
    $('btn-connect').onclick = () => void this.connect($<HTMLSelectElement>('select-device').value);
    $<HTMLSelectElement>('select-device').onchange = () => void this.connect($<HTMLSelectElement>('select-device').value);
    $('btn-reset-audio').onclick = () => this.callbacks.onResetAudioSession();

    $('btn-calibrate').onclick = async () => {
      const button = $<HTMLButtonElement>('btn-calibrate');
      button.disabled = true;
      try {
        if (await this.connect()) {
          await this.callbacks.onCalibrateNoise(p => {
            button.textContent = `Stay quiet… ${Math.round(p * 100)}%`;
          });
        }
      } finally {
        button.disabled = false;
        button.textContent = 'Calibrate room';
      }
    };

    $('tab-mic').onclick = async () => {
      this.callbacks.onOpenSettings();
      this.setMode('mic');
      await this.connect();
    };

    $('tab-piano').onclick = () => {
      this.callbacks.onOpenSettings();
      this.setMode('piano');
      soundSynth.setAudioSessionType('playback');
      soundSynth.isMuted = false;
      this.renderSoundButton(false);
      soundSynth.initCtx();
    };

    $('btn-toggle-labels').onclick = () => {
      const on = $('piano-hud-section').classList.toggle('show-labels');
      $('btn-toggle-labels').textContent = `Notes: ${on ? 'on' : 'off'}`;
    };
    $('btn-toggle-hints').onclick = () => {
      const on = $('piano-hud-section').classList.toggle('show-hints');
      $('btn-toggle-hints').textContent = `Keys: ${on ? 'on' : 'off'}`;
    };
    $('btn-reference').onclick = () => {
      if (this.currentTarget) this.callbacks.onReference(this.currentTarget);
    };

    $<HTMLSelectElement>('select-tolerance').onchange = () => {
      const value = +$<HTMLSelectElement>('select-tolerance').value;
      this.matcher.setTolerance(value);
      this.callbacks.onUpdateTolerance(value);
    };
    $<HTMLInputElement>('range-sensitivity').oninput = () => {
      const value = +$<HTMLInputElement>('range-sensitivity').value;
      $('label-sensitivity').textContent = `${value.toFixed(1)}×`;
      this.callbacks.onUpdateSensitivity(value);
    };
    $<HTMLInputElement>('range-sfx-vol').oninput = () => soundSynth.sfxVolume = +$<HTMLInputElement>('range-sfx-vol').value;
    $<HTMLInputElement>('range-piano-vol').oninput = () => soundSynth.pianoVolume = +$<HTMLInputElement>('range-piano-vol').value;
    $<HTMLInputElement>('check-echo-filter').onchange = () => this.callbacks.onToggleEchoFilter($<HTMLInputElement>('check-echo-filter').checked);
    $<HTMLInputElement>('check-reduced-motion').onchange = () => this.callbacks.onToggleReducedMotion($<HTMLInputElement>('check-reduced-motion').checked);

    document.querySelectorAll<HTMLElement>('.piano-key').forEach(key => {
      key.onpointerdown = e => {
        if (this.currentMode !== 'piano') return;
        e.preventDefault();
        soundSynth.initCtx();
        key.setPointerCapture(e.pointerId);
        this.down(`p${e.pointerId}`, key.dataset.note!, +key.dataset.octave!);
      };
      key.onpointerup = key.onpointercancel = e => { this.up(`p${e.pointerId}`); };
      key.onlostpointercapture = e => this.up(`p${e.pointerId}`);
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('modal-settings').classList.contains('hidden')) $('modal-settings').classList.add('hidden');
        else this.callbacks.onTogglePause();
        return;
      }
      if (e.code === 'Space' && !e.repeat && $('modal-start').classList.contains('hidden') && $('modal-settings').classList.contains('hidden')) {
        e.preventDefault();
        this.callbacks.onActivateNova();
        return;
      }
      if (
        this.currentMode !== 'piano' ||
        e.repeat || e.ctrlKey || e.metaKey || e.altKey ||
        (e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))
      ) return;

      const data = KEY_MAP.get(e.key.toLowerCase());
      if (data) {
        e.preventDefault();
        soundSynth.initCtx();
        this.down(e.key.toLowerCase(), data.note, data.octave);
      }
    });
    window.addEventListener('keyup', e => this.up(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.releaseKeys());
  }

  private setMode(mode: GameInputMode) {
    this.releaseKeys();
    this.currentMode = mode;
    $('tab-mic').classList.toggle('active', mode === 'mic');
    $('tab-piano').classList.toggle('active', mode === 'piano');
    $('mic-hud-section').classList.toggle('hidden', mode !== 'mic');
    $('piano-hud-section').classList.toggle('hidden', mode !== 'piano');
    document.body.dataset.mode = mode;
    this.callbacks.onChangeInputMode(mode);
  }

  private down(source: string, note: string, octave: number) {
    if (this.held.has(source)) return;
    this.held.set(source, { note, octave });
    this.matcher.reset();
    this.callbacks.onPianoNoteDown(note, octave);
    this.paintKeys();
  }

  private up(source: string) {
    const data = this.held.get(source);
    if (!data) return;
    this.held.delete(source);
    this.matcher.reset();
    if (![...this.held.values()].some(v => v.note === data.note && v.octave === data.octave)) {
      this.callbacks.onPianoNoteUp(data.note, data.octave);
    }
    this.paintKeys();
  }

  private paintKeys() {
    document.querySelectorAll<HTMLElement>('.piano-key').forEach(el => {
      el.classList.toggle(
        'active',
        [...this.held.values()].some(v => v.note === el.dataset.note && v.octave === +el.dataset.octave!)
      );
    });
  }

  public releaseKeys() {
    this.held.clear();
    this.activePianoHoldProgress = 0;
    this.matcher.reset();
    soundSynth.releaseAllPianoNotes();
    this.paintKeys();
    const fill = $('piano-hold-fill');
    if (fill) fill.style.width = '0%';
  }

  public setPlaying(playing: boolean) {
    this.active = playing;
    if (!playing) this.releaseKeys();
  }

  public getActivePianoNote(): string | null {
    return this.held.size === 1 ? [...this.held.values()][0].note : null;
  }

  public getPianoHoldProgress(): number {
    return this.activePianoHoldProgress;
  }

  public updatePiano(dt: number) {
    if (this.currentMode !== 'piano' || !this.active) return;
    const valid = this.held.size === 1 ? [...this.held.values()][0] : null;
    const result = this.matcher.update(valid?.note || null, valid?.octave || 4, 0, valid ? 1 : 0, dt);
    this.activePianoHoldProgress = result.holdProgress;
    $('piano-hold-fill').style.width = `${Math.round(result.holdProgress * 100)}%`;
    $('piano-status').textContent =
      this.held.size > 1
        ? 'One note at a time — release extra keys.'
        : valid
          ? `${valid.note} · charging ${Math.round(result.holdProgress * 100)}%`
          : `Target ${this.currentTarget || '—'} · hold one key to fire`;
  }

  public updateInputStatus(status: InputStatus) {
    if (performance.now() - this.lastDiagnostics < 100) return;
    this.lastDiagnostics = performance.now();
    $('input-message').textContent = status.message;
    $('settings-input-status').textContent = status.message;
    $('device-label').textContent = status.device;
    $('btn-mic-toggle').textContent = status.connected ? 'Mic live' : 'Connect';
    $('btn-mic-toggle').classList.toggle('connected', status.connected);
    $('mic-meter-fill').style.width = `${Math.min(100, Math.sqrt(status.level) * 280)}%`;

    const s = status.settings;
    const setting = (v: boolean | undefined) => (v === undefined ? 'unavailable' : v ? 'on' : 'off');
    $('input-diagnostics').textContent =
      `Raw level: ${status.level.toFixed(4)}\n` +
      `Gate: ${status.threshold.toFixed(4)}\n` +
      `Confidence: ${(status.confidence * 100).toFixed(0)}%\n` +
      `Frequency: ${status.frequency.toFixed(1)} Hz\n` +
      `Sample rate: ${s?.sampleRate || 'unavailable'}\n` +
      `Audio session: ${status.audioSession}\n` +
      `Automatic gain: ${setting(s?.autoGainControl)}\n` +
      `Noise suppression: ${setting(s?.noiseSuppression)}\n` +
      `Echo cancellation: ${setting(s?.echoCancellation)}`;
  }

  public updateHealth(hp: number, max: number) {
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    const fill = $('health-bar-fill');
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', pct <= 35);
    $('health-value').textContent = `${Math.ceil(hp)}`;
  }

  public updateScore(score: number, combo: number) {
    $('hud-score').textContent = score.toLocaleString();
    const badge = $('hud-combo');
    badge.textContent = `×${combo.toFixed(1)}`;
    badge.classList.toggle('hot', combo >= 2.0);
  }

  public updateNova(progress: number, ready: boolean) {
    const btn = $<HTMLButtonElement>('btn-nova');
    const pct = Math.round(progress * 100);
    btn.disabled = !ready;
    btn.classList.toggle('ready', ready);
    $('nova-fill').style.width = `${pct}%`;
    $('nova-text').textContent = ready ? 'NOVA READY!' : `NOVA ${pct}%`;
  }

  public updateWave(wave: number) {
    $('hud-wave').textContent = String(wave).padStart(2, '0');
  }

  public updateTimer(seconds: number) {
    $('hud-timer').textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  }

  public setTargetNote(note: string | null) {
    this.currentTarget = note;
    $('target-note-badge').textContent = note || '—';
  }

  public updatePitchDisplay(result: PitchDetectionResult | null) {
    $('detected-note-badge').textContent = result ? `${result.noteName}${result.octave}` : '—';
    $('tuning-needle').style.left = `${50 + (result ? Math.max(-50, Math.min(50, result.cents)) : 0)}%`;
    $('hold-progress-fill').style.width = `${(result?.matchStatus.holdProgress || 0) * 100}%`;
    $('tune-status').textContent = result
      ? `${Math.round(result.cents) > 0 ? '+' : ''}${Math.round(result.cents)}¢ · ${result.matchStatus.inTune ? 'HOLD STEADY' : 'ADJUST PITCH'}`
      : 'LISTENING';
  }

  public showPause(show: boolean) {
    $('modal-pause').classList.toggle('hidden', !show);
  }

  public showWaveBanner(wave: number, title: string) {
    window.clearTimeout(this.bannerTimer);
    $('wave-banner-title').textContent = `Wave ${wave}`;
    $('wave-banner-sub').textContent = title;
    $('wave-banner').classList.remove('hidden');
    this.bannerTimer = window.setTimeout(() => $('wave-banner').classList.add('hidden'), 1800);
  }

  public showGameOver(score: number, wave: number, best: number, hits: number) {
    this.setPlaying(false);
    $('final-score').textContent = score.toLocaleString();
    $('best-score').textContent = best.toLocaleString();
    $('final-wave').textContent = `${wave}`;
    $('final-hits').textContent = `${hits}`;
    $('modal-gameover').classList.remove('hidden');
  }
}
