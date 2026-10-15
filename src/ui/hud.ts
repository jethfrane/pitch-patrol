/**
 * Pitch Patrol - Comprehensive HUD, Authentic Piano & Settings System
 */

import { soundSynth } from '../audio/sound-synth';
import { PitchDetectionResult } from '../audio/pitch-detector';

export type GameInputMode = 'mic' | 'piano';

export interface HUDCallbacks {
  onStartGame: () => void;
  onRestartGame: () => void;
  onTogglePause: () => void;
  onToggleMic: () => Promise<boolean>;
  onCalibrateNoise: (onProgress: (p: number) => void) => Promise<number>;
  onPianoAttack: (note: string) => void;
  onPianoNoteDown: (note: string) => void;
  onPianoNoteUp: (note: string) => void;
  onChangeInputMode: (mode: GameInputMode) => void;
  onUpdateTolerance: (cents: number) => void;
  onUpdateSensitivity: (mult: number) => void;
  onToggleReducedMotion: (enabled: boolean) => void;
}

export class HUD {
  private container: HTMLElement;
  private callbacks: HUDCallbacks;

  public currentMode: GameInputMode = 'mic';

  // Top HUD elements
  private healthBarFill!: HTMLElement;
  private healthValueEl!: HTMLElement;
  private scoreEl!: HTMLElement;
  private comboEl!: HTMLElement;
  private waveEl!: HTMLElement;
  private timerEl!: HTMLElement;
  private pauseBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;

  // Bottom HUD elements
  private targetBadgeEl!: HTMLElement;
  private detectedBadgeEl!: HTMLElement;
  private tuningNeedleEl!: HTMLElement;
  private tuningStatusEl!: HTMLElement;
  private holdProgressRing!: HTMLElement;
  private micToggleBtn!: HTMLButtonElement;
  private micVolumeBar!: HTMLElement;

  // Piano elements
  private pianoContainer!: HTMLElement;
  private toggleLabelsBtn!: HTMLButtonElement;
  private toggleKeysBtn!: HTMLButtonElement;
  private showLabels = false;
  private showKeyHints = false;

  // Modals & Banners
  private startModal!: HTMLElement;
  private gameOverModal!: HTMLElement;
  private pauseModal!: HTMLElement;
  private settingsModal!: HTMLElement;
  private finalScoreEl!: HTMLElement;
  private bestScoreEl!: HTMLElement;
  private finalWaveEl!: HTMLElement;
  private finalAccuracyEl!: HTMLElement;
  private waveBannerEl!: HTMLElement;
  private waveBannerTitleEl!: HTMLElement;
  private waveBannerSubEl!: HTMLElement;

  // Key tracking to prevent OS key-repeat cheating
  private heldKeyboardKeys: Set<string> = new Set();
  private multiKeyMashTimer = 0;

  constructor(container: HTMLElement, callbacks: HUDCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.buildHTML();
    this.attachEvents();
  }

  private buildHTML(): void {
    this.container.innerHTML = `
      <!-- TOP HUD -->
      <div id="top-hud" class="hud-panel top-bar">
        <!-- Health Section -->
        <div class="hud-group health-group">
          <div class="health-card">
            <span class="heart-icon">💖</span>
            <div class="health-bar-track">
              <div id="health-bar-fill" class="health-bar-fill"></div>
            </div>
            <span id="health-value" class="health-value">100</span>
          </div>
        </div>

        <!-- Center Wave & Timer -->
        <div class="hud-group center-group">
          <div class="hud-item wave-box">
            <span class="hud-label">WAVE</span>
            <span id="hud-wave" class="hud-value">01</span>
          </div>
          <div class="hud-item timer-box">
            <span class="hud-label">TIME</span>
            <span id="hud-timer" class="hud-value">00:00</span>
          </div>
        </div>

        <!-- Right Score & Actions -->
        <div class="hud-group actions-group">
          <div class="hud-item score-box">
            <span class="hud-label">SCORE</span>
            <span id="hud-score" class="hud-value">0</span>
          </div>
          <div id="hud-combo" class="hud-badge combo-badge">x1.0</div>
          <button id="btn-sound" class="hud-btn" title="Toggle Sound">🔊</button>
          <button id="btn-settings" class="hud-btn" title="Settings">⚙️</button>
          <button id="btn-pause" class="hud-btn" title="Pause Game">⏸</button>
        </div>
      </div>

      <!-- BOTTOM HUD -->
      <div id="bottom-hud" class="hud-panel bottom-bar">
        <!-- Mode Switcher Tabs -->
        <div class="mode-switcher">
          <button id="tab-mic" class="mode-tab active">🎤 Vocal Survival</button>
          <button id="tab-piano" class="mode-tab">🎹 Piano Survival & Practice</button>
        </div>

        <!-- TUNING & HOLD STATUS (MIC MODE) -->
        <div id="mic-hud-section" class="tuner-row">
          <!-- Urgent Target -->
          <div class="target-card">
            <span class="card-caption">APPROACHING THREAT</span>
            <div id="target-note-badge" class="note-pill target-pill">--</div>
          </div>

          <!-- Needle Tuning Gauge & Hold Progress -->
          <div class="gauge-card">
            <div class="gauge-labels">
              <span>FLAT</span>
              <span id="tune-status">SING & HOLD PITCH</span>
              <span>SHARP</span>
            </div>
            <div class="gauge-track">
              <div class="center-target-line"></div>
              <div id="tuning-needle" class="gauge-needle"></div>
            </div>

            <!-- Hold Progress Bar -->
            <div class="hold-progress-track" title="Hold steady to fire!">
              <div id="hold-progress-fill" class="hold-progress-fill"></div>
            </div>
          </div>

          <!-- Your Detected Pitch -->
          <div class="detected-card">
            <span class="card-caption">YOUR PITCH</span>
            <div id="detected-note-badge" class="note-pill detected-pill">--</div>
          </div>

          <!-- Mic Controls -->
          <div class="mic-controls-mini">
            <button id="btn-mic-toggle" class="mic-btn active" title="Toggle Microphone">
              <span class="mic-icon">🎤</span>
              <span class="mic-text">On</span>
            </button>
            <div class="mic-meter"><div id="mic-meter-fill"></div></div>
          </div>
        </div>

        <!-- AUTHENTIC PIANO KEYBOARD (PIANO MODE) -->
        <div id="piano-hud-section" class="piano-section hidden">
          <div class="piano-toolbar">
            <span class="piano-hint">Play or tap keys to sound musical notes and attack targets!</span>
            <div class="piano-toggles">
              <button id="btn-toggle-labels" class="mini-btn">Show Note Labels: OFF</button>
              <button id="btn-toggle-hints" class="mini-btn">Show Key Hints: OFF</button>
            </div>
          </div>

          <!-- Authentic Piano Keys (White & Black Layout) -->
          <div class="piano-keyboard" id="piano-keyboard">
            <!-- C4 to B4 Octave -->
            <div class="piano-key white" data-note="C" data-key="a"><span class="key-label">C</span><span class="key-hint">A</span></div>
            <div class="piano-key black" data-note="C♯" data-key="w"><span class="key-label">C♯</span><span class="key-hint">W</span></div>
            <div class="piano-key white" data-note="D" data-key="s"><span class="key-label">D</span><span class="key-hint">S</span></div>
            <div class="piano-key black" data-note="D♯" data-key="e"><span class="key-label">D♯</span><span class="key-hint">E</span></div>
            <div class="piano-key white" data-note="E" data-key="d"><span class="key-label">E</span><span class="key-hint">D</span></div>
            <div class="piano-key white" data-note="F" data-key="f"><span class="key-label">F</span><span class="key-hint">F</span></div>
            <div class="piano-key black" data-note="F♯" data-key="t"><span class="key-label">F♯</span><span class="key-hint">T</span></div>
            <div class="piano-key white" data-note="G" data-key="g"><span class="key-label">G</span><span class="key-hint">G</span></div>
            <div class="piano-key black" data-note="G♯" data-key="y"><span class="key-label">G♯</span><span class="key-hint">Y</span></div>
            <div class="piano-key white" data-note="A" data-key="h"><span class="key-label">A</span><span class="key-hint">H</span></div>
            <div class="piano-key black" data-note="A♯" data-key="u"><span class="key-label">A♯</span><span class="key-hint">U</span></div>
            <div class="piano-key white" data-note="B" data-key="j"><span class="key-label">B</span><span class="key-hint">J</span></div>
            <!-- High C5 -->
            <div class="piano-key white" data-note="C" data-key="k"><span class="key-label">C5</span><span class="key-hint">K</span></div>
          </div>
        </div>
      </div>

      <!-- START MODAL -->
      <div id="modal-start" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-badge">🎵 3D MUSICAL SURVIVAL</div>
          <h1 class="modal-title">PITCH PATROL</h1>
          <p class="modal-subtitle">Protect Melody Garden by singing or playing the notes shown above approaching musical creatures!</p>
          
          <div class="instruction-grid">
            <div class="instruction-step">
              <span class="step-num">1</span>
              <div>
                <strong>Intentional Pitch Matching:</strong> Hold your sung pitch steady for ~300ms. The game rejects random noises and transient sweeps.
              </div>
            </div>
            <div class="instruction-step">
              <span class="step-num">2</span>
              <div>
                <strong>Health-Based Survival:</strong> You have 100 HP. Enemies attack the boundary with wind-up cycles instead of instant death.
              </div>
            </div>
            <div class="instruction-step">
              <span class="step-num">3</span>
              <div>
                <strong>Headphone Recommendation:</strong> 🎧 Wear headphones for best pitch recognition so your speakers don't bleed into the mic.
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button id="btn-start" class="primary-btn">▶ START CONCERT</button>
          </div>
        </div>
      </div>

      <!-- SETTINGS MODAL -->
      <div id="modal-settings" class="modal-overlay hidden">
        <div class="modal-card">
          <div class="modal-badge">AUDIO & GAMEPLAY SETTINGS</div>
          <h2>SETTINGS</h2>

          <div class="settings-list">
            <!-- Noise Calibration -->
            <div class="setting-item">
              <div class="setting-info">
                <strong>Ambient Noise Calibration</strong>
                <span>Measures room background noise to prevent false hits.</span>
              </div>
              <button id="btn-calibrate" class="secondary-btn">🎙️ Calibrate (1s)</button>
            </div>
            <div id="calibration-bar-track" class="progress-track hidden">
              <div id="calibration-bar-fill" class="progress-fill"></div>
            </div>

            <!-- Pitch Tolerance -->
            <div class="setting-item">
              <div class="setting-info">
                <strong>Pitch Tolerance Window</strong>
                <span>Choose standard tuning (±35c) or beginner-friendly (±45c).</span>
              </div>
              <select id="select-tolerance" class="hud-select">
                <option value="35" selected>Standard (±35 cents)</option>
                <option value="45">Beginner (±45 cents)</option>
                <option value="25">Expert (±25 cents)</option>
              </select>
            </div>

            <!-- Mic Sensitivity -->
            <div class="setting-item">
              <div class="setting-info">
                <strong>Microphone Sensitivity</strong>
                <span id="label-sensitivity">1.0x</span>
              </div>
              <input type="range" id="range-sensitivity" min="0.5" max="2.5" step="0.1" value="1.0" class="hud-slider" />
            </div>

            <!-- Master Volumes -->
            <div class="setting-item">
              <div class="setting-info">
                <strong>SFX Volume</strong>
                <span id="label-sfx-vol">60%</span>
              </div>
              <input type="range" id="range-sfx-vol" min="0" max="1" step="0.05" value="0.6" class="hud-slider" />
            </div>

            <div class="setting-item">
              <div class="setting-info">
                <strong>Piano Volume</strong>
                <span id="label-piano-vol">70%</span>
              </div>
              <input type="range" id="range-piano-vol" min="0" max="1" step="0.05" value="0.7" class="hud-slider" />
            </div>

            <!-- Reduced Motion -->
            <div class="setting-item">
              <div class="setting-info">
                <strong>Reduced Motion & Shake</strong>
                <span>Disables camera effects and intense flashing.</span>
              </div>
              <input type="checkbox" id="check-reduced-motion" class="hud-checkbox" />
            </div>
          </div>

          <button id="btn-close-settings" class="primary-btn">DONE</button>
        </div>
      </div>

      <!-- PAUSE MODAL -->
      <div id="modal-pause" class="modal-overlay hidden">
        <div class="modal-card mini">
          <h2>GAME PAUSED</h2>
          <p>Catch your breath! Resume when ready to sing or play.</p>
          <button id="btn-resume" class="primary-btn">RESUME</button>
        </div>
      </div>

      <!-- CELEBRATORY WAVE BANNER -->
      <div id="wave-banner" class="wave-banner hidden">
        <span id="wave-banner-sub" class="wave-banner-sub">GET READY</span>
        <h1 id="wave-banner-title" class="wave-banner-title">WAVE 01</h1>
      </div>

      <!-- GAME OVER MODAL -->
      <div id="modal-gameover" class="modal-overlay hidden">
        <div class="modal-card">
          <div class="modal-badge danger">HEALTH DEPLETED</div>
          <h2>CONCERT FINISHED</h2>
          
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-label">FINAL SCORE</span>
              <span id="final-score" class="stat-val">0</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">BEST SCORE</span>
              <span id="best-score" class="stat-val">0</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">WAVES SURVIVED</span>
              <span id="final-wave" class="stat-val">01</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">ACCURACY</span>
              <span id="final-accuracy" class="stat-val">100%</span>
            </div>
          </div>

          <button id="btn-retry" class="primary-btn">🔄 PLAY AGAIN</button>
        </div>
      </div>
    `;

    // Cache elements
    this.healthBarFill = document.getElementById('health-bar-fill')!;
    this.healthValueEl = document.getElementById('health-value')!;
    this.scoreEl = document.getElementById('hud-score')!;
    this.comboEl = document.getElementById('hud-combo')!;
    this.waveEl = document.getElementById('hud-wave')!;
    this.timerEl = document.getElementById('hud-timer')!;
    this.pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
    this.soundBtn = document.getElementById('btn-sound') as HTMLButtonElement;
    this.settingsBtn = document.getElementById('btn-settings') as HTMLButtonElement;

    this.targetBadgeEl = document.getElementById('target-note-badge')!;
    this.detectedBadgeEl = document.getElementById('detected-note-badge')!;
    this.tuningNeedleEl = document.getElementById('tuning-needle')!;
    this.tuningStatusEl = document.getElementById('tune-status')!;
    this.holdProgressRing = document.getElementById('hold-progress-fill')!;
    this.micToggleBtn = document.getElementById('btn-mic-toggle') as HTMLButtonElement;
    this.micVolumeBar = document.getElementById('mic-meter-fill')!;

    this.pianoContainer = document.getElementById('piano-hud-section')!;
    this.toggleLabelsBtn = document.getElementById('btn-toggle-labels') as HTMLButtonElement;
    this.toggleKeysBtn = document.getElementById('btn-toggle-hints') as HTMLButtonElement;

    this.startModal = document.getElementById('modal-start')!;
    this.pauseModal = document.getElementById('modal-pause')!;
    this.settingsModal = document.getElementById('modal-settings')!;
    this.gameOverModal = document.getElementById('modal-gameover')!;
    this.finalScoreEl = document.getElementById('final-score')!;
    this.bestScoreEl = document.getElementById('best-score')!;
    this.finalWaveEl = document.getElementById('final-wave')!;
    this.finalAccuracyEl = document.getElementById('final-accuracy')!;

    this.waveBannerEl = document.getElementById('wave-banner')!;
    this.waveBannerTitleEl = document.getElementById('wave-banner-title')!;
    this.waveBannerSubEl = document.getElementById('wave-banner-sub')!;
  }

  private attachEvents(): void {
    // Start button
    document.getElementById('btn-start')?.addEventListener('click', async () => {
      this.startModal.classList.add('hidden');
      if (this.currentMode === 'mic') {
        await this.callbacks.onToggleMic();
      }
      this.callbacks.onStartGame();
    });

    // Pause / Resume
    this.pauseBtn.addEventListener('click', () => this.callbacks.onTogglePause());
    document.getElementById('btn-resume')?.addEventListener('click', () => this.callbacks.onTogglePause());

    // Settings
    this.settingsBtn.addEventListener('click', () => this.settingsModal.classList.remove('hidden'));
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.settingsModal.classList.add('hidden'));

    // Retry
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      this.gameOverModal.classList.add('hidden');
      this.callbacks.onRestartGame();
    });

    // Sound toggle
    this.soundBtn.addEventListener('click', () => {
      soundSynth.isMuted = !soundSynth.isMuted;
      this.soundBtn.textContent = soundSynth.isMuted ? '🔇' : '🔊';
    });

    // Mic toggle button
    this.micToggleBtn.addEventListener('click', async () => {
      const active = await this.callbacks.onToggleMic();
      this.micToggleBtn.classList.toggle('active', active);
      this.micToggleBtn.querySelector('.mic-text')!.textContent = active ? 'On' : 'Off';
    });

    // Mode Switcher Tabs
    const tabMic = document.getElementById('tab-mic')!;
    const tabPiano = document.getElementById('tab-piano')!;
    const micSection = document.getElementById('mic-hud-section')!;

    tabMic.addEventListener('click', async () => {
      this.currentMode = 'mic';
      tabMic.classList.add('active');
      tabPiano.classList.remove('active');
      micSection.classList.remove('hidden');
      this.pianoContainer.classList.add('hidden');
      await this.callbacks.onToggleMic();
      this.callbacks.onChangeInputMode('mic');
    });

    tabPiano.addEventListener('click', () => {
      this.currentMode = 'piano';
      tabPiano.classList.add('active');
      tabMic.classList.remove('active');
      micSection.classList.add('hidden');
      this.pianoContainer.classList.remove('hidden');
      this.callbacks.onChangeInputMode('piano');
    });

    // Piano Toggles
    this.toggleLabelsBtn.addEventListener('click', () => {
      this.showLabels = !this.showLabels;
      this.toggleLabelsBtn.textContent = `Show Note Labels: ${this.showLabels ? 'ON' : 'OFF'}`;
      this.pianoContainer.classList.toggle('show-labels', this.showLabels);
    });

    this.toggleKeysBtn.addEventListener('click', () => {
      this.showKeyHints = !this.showKeyHints;
      this.toggleKeysBtn.textContent = `Show Key Hints: ${this.showKeyHints ? 'ON' : 'OFF'}`;
      this.pianoContainer.classList.toggle('show-hints', this.showKeyHints);
    });

    // Piano key interactions with full glissando / drag support
    const keys = document.querySelectorAll('.piano-key');
    let activePointerKey: HTMLElement | null = null;
    let isPointerPressed = false;

    const playKey = (keyEl: HTMLElement) => {
      const note = keyEl.dataset.note;
      if (!note) return;
      if (activePointerKey === keyEl) return;

      if (activePointerKey) {
        const oldNote = activePointerKey.dataset.note;
        activePointerKey.classList.remove('active');
        if (oldNote) this.callbacks.onPianoNoteUp(oldNote);
      }

      activePointerKey = keyEl;
      keyEl.classList.add('active');
      this.callbacks.onPianoNoteDown(note);
      if (this.currentMode === 'piano') {
        this.callbacks.onPianoAttack(note);
      }
    };

    const stopActiveKey = () => {
      if (activePointerKey) {
        const note = activePointerKey.dataset.note;
        activePointerKey.classList.remove('active');
        if (note) this.callbacks.onPianoNoteUp(note);
        activePointerKey = null;
      }
    };

    keys.forEach(keyEl => {
      const htmlKey = keyEl as HTMLElement;
      htmlKey.addEventListener('pointerdown', (e: Event) => {
        e.preventDefault();
        isPointerPressed = true;
        playKey(htmlKey);
      });

      htmlKey.addEventListener('pointerenter', () => {
        if (isPointerPressed) {
          playKey(htmlKey);
        }
      });
    });

    window.addEventListener('pointerup', () => {
      if (isPointerPressed) {
        isPointerPressed = false;
        stopActiveKey();
      }
    });

    window.addEventListener('pointercancel', () => {
      if (isPointerPressed) {
        isPointerPressed = false;
        stopActiveKey();
      }
    });

    // Computer keyboard mapping for piano
    const KEY_MAP: Record<string, string> = {
      'a': 'C', 'w': 'C♯', 's': 'D', 'e': 'D♯', 'd': 'E',
      'f': 'F', 't': 'F♯', 'g': 'G', 'y': 'G♯', 'h': 'A',
      'u': 'A♯', 'j': 'B', 'k': 'C'
    };

    window.addEventListener('keydown', (e) => {
      // Disallow cheat shortcuts in Microphone mode
      if (this.currentMode !== 'piano') return;
      if (e.repeat) return; // Ignore OS repeat

      const char = e.key.toLowerCase();
      if (KEY_MAP[char]) {
        const now = performance.now();
        // Prevent multi-key simultaneous mashing cheat
        if (now - this.multiKeyMashTimer < 40 && this.heldKeyboardKeys.size >= 1) {
          // Simultaneous mashing detected; reject as invalid chord attempt
          return;
        }
        this.multiKeyMashTimer = now;
        this.heldKeyboardKeys.add(char);

        const note = KEY_MAP[char];
        const keyEl = document.querySelector(`.piano-key[data-key="${char}"]`);
        if (keyEl) keyEl.classList.add('active');

        this.callbacks.onPianoNoteDown(note);
        this.callbacks.onPianoAttack(note);
      }
    });

    window.addEventListener('keyup', (e) => {
      const char = e.key.toLowerCase();
      if (KEY_MAP[char]) {
        this.heldKeyboardKeys.delete(char);
        const note = KEY_MAP[char];
        const keyEl = document.querySelector(`.piano-key[data-key="${char}"]`);
        if (keyEl) keyEl.classList.remove('active');
        this.callbacks.onPianoNoteUp(note);
      }
    });

    // Settings Controls
    const tolSelect = document.getElementById('select-tolerance') as HTMLSelectElement;
    tolSelect?.addEventListener('change', () => {
      this.callbacks.onUpdateTolerance(parseInt(tolSelect.value, 10));
    });

    const sensSlider = document.getElementById('range-sensitivity') as HTMLInputElement;
    const sensLabel = document.getElementById('label-sensitivity')!;
    sensSlider?.addEventListener('input', () => {
      const val = parseFloat(sensSlider.value);
      sensLabel.textContent = `${val.toFixed(1)}x`;
      this.callbacks.onUpdateSensitivity(val);
    });

    const sfxSlider = document.getElementById('range-sfx-vol') as HTMLInputElement;
    const sfxLabel = document.getElementById('label-sfx-vol')!;
    sfxSlider?.addEventListener('input', () => {
      soundSynth.sfxVolume = parseFloat(sfxSlider.value);
      sfxLabel.textContent = `${Math.round(soundSynth.sfxVolume * 100)}%`;
    });

    const pianoSlider = document.getElementById('range-piano-vol') as HTMLInputElement;
    const pianoLabel = document.getElementById('label-piano-vol')!;
    pianoSlider?.addEventListener('input', () => {
      soundSynth.pianoVolume = parseFloat(pianoSlider.value);
      pianoLabel.textContent = `${Math.round(soundSynth.pianoVolume * 100)}%`;
    });

    const motionCheck = document.getElementById('check-reduced-motion') as HTMLInputElement;
    motionCheck?.addEventListener('change', () => {
      this.callbacks.onToggleReducedMotion(motionCheck.checked);
    });

    // Calibrate button
    const calibBtn = document.getElementById('btn-calibrate') as HTMLButtonElement;
    const calibTrack = document.getElementById('calibration-bar-track')!;
    const calibFill = document.getElementById('calibration-bar-fill')!;
    calibBtn?.addEventListener('click', async () => {
      calibBtn.disabled = true;
      calibBtn.textContent = 'Listening to room...';
      calibTrack.classList.remove('hidden');

      await this.callbacks.onCalibrateNoise((progress) => {
        calibFill.style.width = `${Math.round(progress * 100)}%`;
      });

      calibBtn.textContent = '✓ Calibrated!';
      setTimeout(() => {
        calibBtn.disabled = false;
        calibBtn.textContent = '🎙️ Calibrate (1s)';
        calibTrack.classList.add('hidden');
        calibFill.style.width = '0%';
      }, 1500);
    });
  }

  public updateHealth(current: number, max: number): void {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    this.healthBarFill.style.width = `${pct}%`;
    this.healthValueEl.textContent = `${Math.round(current)}`;

    if (pct < 30) {
      this.healthBarFill.style.backgroundColor = '#FF8493'; // Danger coral
    } else if (pct < 60) {
      this.healthBarFill.style.backgroundColor = '#FFD36E'; // Warning gold
    } else {
      this.healthBarFill.style.backgroundColor = '#36D6C5'; // Healthy teal
    }
  }

  public updateScore(score: number, combo: number): void {
    this.scoreEl.textContent = score.toLocaleString();
    this.comboEl.textContent = `x${combo.toFixed(1)}`;
    if (combo > 1.5) {
      this.comboEl.classList.add('gold-accent');
    } else {
      this.comboEl.classList.remove('gold-accent');
    }
  }

  public updateWave(wave: number): void {
    this.waveEl.textContent = wave.toString().padStart(2, '0');
  }

  public updateTimer(seconds: number): void {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    this.timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public setTargetNote(note: string | null): void {
    this.targetBadgeEl.textContent = note || '--';
  }

  public updatePitchDisplay(result: PitchDetectionResult | null): void {
    if (!result) {
      this.detectedBadgeEl.textContent = '--';
      this.detectedBadgeEl.className = 'note-pill detected-pill';
      this.tuningNeedleEl.style.left = '50%';
      this.tuningStatusEl.textContent = 'LISTENING...';
      this.tuningStatusEl.style.color = '#17213A';
      this.holdProgressRing.style.width = '0%';
      this.micVolumeBar.style.width = '0%';
      return;
    }

    // Mic volume
    const volPercent = Math.min(100, Math.round(result.volume * 500));
    this.micVolumeBar.style.width = `${volPercent}%`;

    // Note name + Octave
    const octaveSub = result.octave !== undefined ? `<span class="octave-sub">${result.octave}</span>` : '';
    this.detectedBadgeEl.innerHTML = `${result.noteName}${octaveSub}`;

    // Needle mapping (-50 to +50 cents -> 0% to 100%)
    const clampedCents = Math.max(-50, Math.min(50, result.cents));
    const needlePercent = 50 + (clampedCents / 50) * 45;
    this.tuningNeedleEl.style.left = `${needlePercent}%`;

    // Hold progress bar
    const holdPct = Math.round(result.matchStatus.holdProgress * 100);
    this.holdProgressRing.style.width = `${holdPct}%`;

    const inTune = result.matchStatus.inTune;
    const sign = result.cents > 0 ? '+' : '';
    const centsText = `${sign}${Math.round(result.cents)}c`;

    if (inTune) {
      this.detectedBadgeEl.className = 'note-pill detected-pill in-tune';
      this.tuningNeedleEl.style.backgroundColor = '#36D6C5';
      if (result.matchStatus.holdProgress > 0) {
        this.tuningStatusEl.textContent = `★ HOLD STEADY ${holdPct}% (${centsText}) ★`;
        this.tuningStatusEl.style.color = '#36D6C5';
      } else {
        this.tuningStatusEl.textContent = `★ IN TUNE (${centsText}) ★`;
        this.tuningStatusEl.style.color = '#36D6C5';
      }
    } else if (result.cents < -35) {
      this.detectedBadgeEl.className = 'note-pill detected-pill flat';
      this.tuningNeedleEl.style.backgroundColor = '#FFD36E';
      this.tuningStatusEl.textContent = `▲ SING HIGHER (${centsText})`;
      this.tuningStatusEl.style.color = '#FFD36E';
    } else {
      this.detectedBadgeEl.className = 'note-pill detected-pill sharp';
      this.tuningNeedleEl.style.backgroundColor = '#FF8493';
      this.tuningStatusEl.textContent = `▼ SING LOWER (${centsText})`;
      this.tuningStatusEl.style.color = '#FF8493';
    }
  }

  public showPause(show: boolean): void {
    this.pauseModal.classList.toggle('hidden', !show);
  }

  public showWaveBanner(waveNumber: number, title: string): void {
    if (!this.waveBannerEl) return;
    this.waveBannerTitleEl.textContent = `WAVE ${waveNumber.toString().padStart(2, '0')}`;
    this.waveBannerSubEl.textContent = title.toUpperCase();
    this.waveBannerEl.classList.remove('hidden', 'fade-out');
    // Force DOM reflow to re-trigger CSS keyframe animation
    void this.waveBannerEl.offsetWidth;
    this.waveBannerEl.classList.add('banner-anim');

    setTimeout(() => {
      this.waveBannerEl.classList.add('fade-out');
      setTimeout(() => {
        this.waveBannerEl.classList.add('hidden');
        this.waveBannerEl.classList.remove('banner-anim', 'fade-out');
      }, 500);
    }, 1800);
  }

  public showGameOver(score: number, wave: number, bestScore = score, accuracy = 100): void {
    this.finalScoreEl.textContent = score.toLocaleString();
    this.bestScoreEl.textContent = bestScore.toLocaleString();
    this.finalWaveEl.textContent = wave.toString().padStart(2, '0');
    this.finalAccuracyEl.textContent = `${accuracy}%`;
    this.gameOverModal.classList.remove('hidden');
  }
}
