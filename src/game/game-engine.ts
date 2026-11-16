/**
 * Pitch Patrol - 3D Musical Defense Engine
 * Perspective 3/4 Melody Garden, Knockback, Flashing Impact Lights, Harmonic Nova Skill,
 * and Unified Mobile Audio Session Lifecycle.
 */

import * as THREE from 'three';
import { Arena } from './arena';
import { Guardian } from './guardian';
import { Enemy } from './enemies';
import { Projectile } from './projectiles';
import { ParticleSystem } from './particles';
import { PlayerHealth } from './player-health';
import {
  NovaSkill,
  NOVA_HEAL_AMOUNT,
  NOVA_KNOCKBACK_FORCE,
  chooseEnemyBlueprint,
  computeHitScore
} from './combat';
import { PitchDetector, normalizeNoteName, PitchDetectionResult } from '../audio/pitch-detector';
import { soundSynth } from '../audio/sound-synth';
import { HUD, GameInputMode } from '../ui/hud';

const SCALE_WAVE_1_2 = ['C', 'D', 'E', 'G', 'A'];
const SCALE_WAVE_3_4 = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SCALE_WAVE_5_PLUS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private arena!: Arena;
  private guardian!: Guardian;
  private particles!: ParticleSystem;
  private playerHealth!: PlayerHealth;
  private novaSkill = new NovaSkill();
  private pitchDetector: PitchDetector;
  private hud!: HUD;

  // Game Loop State
  public isRunning = false;
  public isPaused = false;
  public inputMode: GameInputMode = 'mic';
  public isReducedMotion = false;

  private score = 0;
  private bestScore = 0;
  private combo = 1.0;
  private wave = 1;
  private survivalTime = 0;
  public practiceMode = false;
  private successfulHits = 0;

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private urgentEnemy: Enemy | null = null;

  // Live pitch/piano charge tracking for 3D beam & target highlights
  private activeCandidateNote: string | null = null;
  private activeCandidateCents = 0;
  private activeHoldProgress = 0;

  // Spawner state
  private waveEnemiesSpawned = 0;
  private waveTotalEnemies = 5;
  private spawnCooldown = 1.8;
  private spawnTimer = 0;

  // Dynamic 3/4 camera framing & shake
  private baseCameraPos = new THREE.Vector3(0, 44, 48);
  private readonly cameraTarget = new THREE.Vector3(0, -0.5, 1.2);
  private shakeIntensity = 0;
  private lastTime = 0;
  private micPausedByHide = false;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.canvas = canvas;
    this.pitchDetector = new PitchDetector();
    this.playerHealth = new PlayerHealth();

    try {
      this.bestScore = parseInt(localStorage.getItem('pitch_patrol_best_score') || '0', 10);
    } catch {
      this.bestScore = 0;
    }

    soundSynth.isMuted = true;
    soundSynth.sfxVolume = 0.65;
    soundSynth.pianoVolume = 0.85;
    this.initThree();
    this.initHUD(uiContainer);
    this.setupHealthCallbacks();
    this.setupPitchCallbacks();
    this.setupResize();
    this.setupLifecycleListeners();

    this.lastTime = performance.now();
    this.renderLoop();
  }

  private setupLifecycleListeners(): void {
    this.pitchDetector.onInputInterrupted = () => {
      if (this.isRunning && !this.isPaused && this.inputMode === 'mic') {
        this.togglePause();
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.isRunning && !this.isPaused) {
          this.togglePause();
        }
        if (this.pitchDetector.isListening) {
          this.micPausedByHide = true;
          this.pitchDetector.stopMic();
        }
      }
    });

    window.addEventListener('pagehide', () => {
      this.pitchDetector.stopMic();
      soundSynth.releaseAllPianoNotes();
    });

    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (this.isRunning && !this.isPaused) this.togglePause();
    });
  }

  private initThree(): void {
    this.scene = new THREE.Scene();
    {
      const sc = document.createElement('canvas');
      sc.width = 4;
      sc.height = 256;
      const sg = sc.getContext('2d')!;
      const gr = sg.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#5B9CF0');
      gr.addColorStop(0.55, '#B7DCFB');
      gr.addColorStop(1, '#FFF3DF');
      sg.fillStyle = gr;
      sg.fillRect(0, 0, 4, 256);
      const st = new THREE.CanvasTexture(sc);
      st.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = st;
    }
    this.scene.fog = new THREE.FogExp2(0xA8D0F5, 0.0014);

    const aspect = Math.max(0.4, window.innerWidth / Math.max(1, window.innerHeight));
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.5, 260);
    this.camera.position.copy(this.baseCameraPos);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    const isSmallScreen = window.innerWidth <= 768;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.75 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.arena = new Arena(this.scene);
    this.guardian = new Guardian(this.scene);
    this.guardian.group.scale.setScalar(1.45);
    this.particles = new ParticleSystem(this.scene);
  }

  private initHUD(uiContainer: HTMLElement): void {
    this.hud = new HUD(uiContainer, {
      onStartGame: () => this.startGame(),
      onEndGame: () => this.gameOver(),
      onRestartGame: () => this.restartGame(),
      onTogglePause: () => { void this.handlePauseToggle(); },
      onToggleMic: async (deviceId) => {
        const ok = await this.pitchDetector.initMic(deviceId);
        if (ok) this.micPausedByHide = false;
        return ok;
      },
      onListDevices: () => this.pitchDetector.listDevices(),
      onOpenSettings: () => {
        if (this.isRunning && !this.isPaused) this.togglePause();
      },
      onPracticeChange: practice => {
        this.practiceMode = practice;
      },
      onReference: note => {
        if (!this.practiceMode) return;
        this.pitchDetector.suspendScoring(1100);
        soundSynth.playReferenceTone(note, 700);
      },
      onCalibrateNoise: async (onProgress) => {
        return await this.pitchDetector.calibrateNoiseFloor(onProgress);
      },
      onPianoAttack: (note: string) => {
        if (this.inputMode === 'piano') {
          this.executeAuthorizedAttack(note, true);
        }
      },
      onPianoNoteDown: (note: string, octave) => {
        soundSynth.startPianoNote(note, octave);
      },
      onPianoNoteUp: (note: string, octave) => {
        soundSynth.stopPianoNote(note, octave);
      },
      onChangeInputMode: (mode: GameInputMode) => {
        this.inputMode = mode;
        this.activeCandidateNote = null;
        this.activeHoldProgress = 0;
        this.pitchDetector.stateMachine.reset();
        try {
          this.bestScore = Number(localStorage.getItem(`pitch_patrol_best_${mode}_${this.practiceMode}`)) || 0;
        } catch {
          this.bestScore = 0;
        }
        if (mode === 'piano') {
          this.pitchDetector.stopMic({ keepPlayback: true });
        }
      },
      onUpdateTolerance: (cents: number) => {
        this.pitchDetector.stateMachine.setTolerance(cents);
      },
      onUpdateSensitivity: (mult: number) => {
        this.pitchDetector.inputSensitivity = mult;
      },
      onToggleEchoFilter: (enabled: boolean) => {
        this.pitchDetector.preferEchoFilter = enabled;
        if (this.pitchDetector.isListening) {
          void this.pitchDetector.initMic(this.pitchDetector.selectedDeviceId);
        }
      },
      onResetAudioSession: () => {
        if (this.inputMode === 'mic') {
          void this.pitchDetector.initMic(this.pitchDetector.selectedDeviceId);
        } else {
          this.pitchDetector.stopMic({ keepPlayback: true });
          soundSynth.initCtx();
        }
      },
      onActivateNova: () => {
        this.activateNovaSkill();
      },
      onToggleReducedMotion: (enabled: boolean) => {
        this.isReducedMotion = enabled;
      }
    });

    this.hud.updateHealth(this.playerHealth.currentHp, this.playerHealth.maxHp);
    this.hud.updateNova(0, false);
  }

  private async handlePauseToggle(): Promise<void> {
    if (!this.isRunning) return;
    if (this.isPaused && this.inputMode === 'mic' && (this.micPausedByHide || !this.pitchDetector.isListening)) {
      this.micPausedByHide = false;
      await this.pitchDetector.initMic();
    }
    this.togglePause();
  }

  private setupHealthCallbacks(): void {
    this.playerHealth.onHealthChange = (hp, maxHp) => {
      this.hud.updateHealth(hp, maxHp);
    };

    this.playerHealth.onDamageTaken = () => {
      soundSynth.playPlayerDamage();
      this.guardian.triggerDamageFeedback();
      this.arena.triggerDamageFlash();
      this.combo = Math.max(1.0, Number((this.combo * 0.6).toFixed(1)));
      this.hud.updateScore(this.score, this.combo);
      this.addCameraShake(0.45);
    };

    this.playerHealth.onDeath = () => {
      this.gameOver();
    };
  }

  private setupPitchCallbacks(): void {
    this.pitchDetector.onAttackAuthorized = (note: string) => {
      if (this.inputMode === 'mic') {
        const isPerfect = Math.abs(this.activeCandidateCents) <= 13;
        this.executeAuthorizedAttack(note, isPerfect);
      }
    };

    this.pitchDetector.onPitchUpdate = (result: PitchDetectionResult | null) => {
      if (this.inputMode === 'mic') {
        this.activeCandidateNote = result?.matchStatus.candidateNote ?? null;
        this.activeCandidateCents = result?.cents ?? 0;
        this.activeHoldProgress = result?.matchStatus.holdProgress ?? 0;
        this.hud.updatePitchDisplay(result);
      }
    };
  }

  private setupResize(): void {
    const resize = () => {
      const width = window.innerWidth;
      const top = document.getElementById('top-hud')?.getBoundingClientRect().bottom || 70;
      const bottom = window.innerHeight - (document.getElementById('bottom-hud')?.getBoundingClientRect().top || window.innerHeight - 150);
      const height = Math.max(140, window.innerHeight - top - bottom);
      const aspect = width / height;

      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();

      // Fit stage + perimeter towers cleanly on wide desktop, portrait phone, and landscape phone
      const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
      const tanV = Math.tan(halfV);
      const distH = 26.8 / Math.max(0.25, tanV * aspect);
      const distV = (25.0 * 0.8) / tanV;
      const dist = Math.max(54, distH, distV);

      // 42° 3/4 hero angle showcasing floating island rim, under-crystal, and 3D characters
      this.baseCameraPos.set(0, dist * 0.65, dist * 0.76);
      this.camera.position.copy(this.baseCameraPos);
      this.camera.lookAt(this.cameraTarget);

      this.renderer.setSize(width, height);
      this.canvas.style.top = `${top}px`;
    };
    window.addEventListener('resize', resize);
    const bottomHud = document.getElementById('bottom-hud');
    if (bottomHud) new ResizeObserver(resize).observe(bottomHud);
    resize();
  }

  private addCameraShake(amount: number): void {
    if (this.isReducedMotion) return;
    this.shakeIntensity = Math.min(0.85, Math.max(this.shakeIntensity, amount));
  }

  public startGame(): void {
    this.isRunning = true;
    this.isPaused = false;
    this.hud.showPause(false);
    this.hud.setPlaying(true);
    this.pitchDetector.stateMachine.reset();
    try {
      this.bestScore = Number(localStorage.getItem(`pitch_patrol_best_${this.inputMode}_${this.practiceMode}`)) || 0;
    } catch {
      this.bestScore = 0;
    }
    this.score = 0;
    this.successfulHits = 0;
    this.combo = 1.0;
    this.wave = 1;
    this.survivalTime = 0;
    this.activeCandidateNote = null;
    this.activeHoldProgress = 0;
    this.novaSkill.reset();
    this.playerHealth.reset();
    this.clearAllEnemies();
    this.startWave(1);
    this.hud.updateScore(this.score, this.combo);
    this.hud.updateWave(this.wave);
    this.hud.updateHealth(this.playerHealth.currentHp, this.playerHealth.maxHp);
    this.hud.updateNova(0, false);
  }

  public async restartGame(): Promise<void> {
    this.clearAllEnemies();
    if (this.inputMode === 'mic' && !this.pitchDetector.isListening) {
      await this.pitchDetector.initMic();
    }
    this.startGame();
  }

  public togglePause(): void {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    this.activeCandidateNote = null;
    this.activeHoldProgress = 0;
    this.pitchDetector.stateMachine.reset();
    this.hud.setPlaying(!this.isPaused);
    this.hud.showPause(this.isPaused);
  }

  private startWave(waveNum: number): void {
    this.wave = waveNum;
    this.waveEnemiesSpawned = 0;
    this.waveTotalEnemies = Math.min(28, 4 + waveNum * 3);
    this.spawnCooldown = Math.max(1.05, 1.95 - waveNum * 0.1);
    this.spawnTimer = 0.25;
    this.hud.updateWave(this.wave);
    soundSynth.playWaveTransition();

    const waveTitles = [
      'Melody Garden Arrival',
      'Rhythm Gathering',
      'Harmonic Flow',
      'Polyphonic Surge',
      'Chromatic Swarm',
      'Virtuoso Sanctuary'
    ];
    const title = waveTitles[Math.min(waveNum - 1, waveTitles.length - 1)];
    this.hud.showWaveBanner(waveNum, title);
  }

  private clearAllEnemies(): void {
    this.enemies.forEach(e => e.destroy(this.scene));
    this.enemies = [];
    this.projectiles.forEach(p => p.destroy(this.scene));
    this.projectiles = [];
    this.urgentEnemy = null;
    this.hud.setTargetNote(null);
    this.arena.updateChargeBeam(this.guardian.getStaffTipWorldPosition(), null, 0);
  }

  private spawnEnemy(): void {
    let pool = SCALE_WAVE_1_2;
    if (this.wave >= 5) pool = SCALE_WAVE_5_PLUS;
    else if (this.wave >= 3) pool = SCALE_WAVE_3_4;

    const rawNote = pool[Math.floor(Math.random() * pool.length)];
    const note = normalizeNoteName(rawNote);
    const blueprint = chooseEnemyBlueprint(this.wave, this.waveEnemiesSpawned, this.waveTotalEnemies);

    const spawnAngle = Math.random() * Math.PI * 2;
    const enemy = new Enemy(
      this.scene,
      { ...blueprint, note, spawnAngle },
      this.arena.stageRadius
    );

    enemy.onAttackImpact = (atkEnemy, dmg) => {
      // Shield impact flash & knockback bounce so enemy physically recoils off barrier
      this.particles.spawnImpactFlash(atkEnemy.group.position, 0xFF5C72, 3.2, 10);
      atkEnemy.applyKnockback(4.6, false);

      if (!this.practiceMode) {
        this.playerHealth.takeDamage(dmg);
      } else {
        soundSynth.playShieldKnockback();
        this.arena.triggerDamageFlash();
      }
    };

    this.enemies.push(enemy);
    this.waveEnemiesSpawned++;
  }

  public executeAuthorizedAttack(matchedNote: string, isPerfect = false): void {
    if (!this.isRunning || this.isPaused) return;

    const normalizedMatch = normalizeNoteName(matchedNote);
    const matchingEnemies = this.enemies.filter(
      e => e.state !== 'dying' && e.state !== 'defeated' && normalizeNoteName(e.note) === normalizedMatch
    );
    if (matchingEnemies.length === 0) return;

    const untargeted = matchingEnemies.filter(e => !e.isTargetedByProjectile);
    if (untargeted.length === 0) return;

    untargeted.sort(
      (a, b) => a.getTimeToImpact(this.arena.protectiveRadius) - b.getTimeToImpact(this.arena.protectiveRadius)
    );
    const target = untargeted[0];
    target.isTargetedByProjectile = true;

    this.guardian.aimAt(target.group.position);
    this.guardian.triggerAttack();

    // Staff muzzle flash light
    const staffTipPos = this.guardian.getStaffTipWorldPosition();
    this.particles.spawnImpactFlash(staffTipPos, isPerfect ? 0xFFD36E : 0x36D6C5, 1.8, 7);

    soundSynth.playPulse(matchedNote, isPerfect);
    if (!soundSynth.isMuted && this.inputMode === 'mic') {
      this.pitchDetector.suspendScoring(280);
    }

    const projectile = new Projectile(this.scene, staffTipPos, target, isPerfect);
    this.projectiles.push(projectile);
  }

  public activateNovaSkill(): boolean {
    if (!this.isRunning || this.isPaused) return false;
    if (!this.novaSkill.consume()) return false;

    this.hud.updateNova(0, false);
    this.guardian.triggerNovaAnim();
    this.arena.triggerHitPulse();
    this.particles.spawnNovaWave(new THREE.Vector3(0, 0.2, 0));
    this.addCameraShake(0.6);

    soundSynth.playNovaSkill();
    if (!soundSynth.isMuted && this.inputMode === 'mic') {
      this.pitchDetector.suspendScoring(550);
    }

    if (!this.practiceMode) {
      this.playerHealth.heal(NOVA_HEAL_AMOUNT);
    }

    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dying' || enemy.state === 'defeated') continue;
      hitCount++;
      const defeated = enemy.hit(NOVA_KNOCKBACK_FORCE);
      this.particles.spawnHitSparks(enemy.group.position, 0x36D6C5, 10);
      if (defeated) {
        this.successfulHits++;
        this.particles.burstConfetti(enemy.group.position, 18);
        const pts = computeHitScore(120, this.combo, false);
        this.score += pts;
        this.combo = Math.min(4.0, Number((this.combo + 0.15).toFixed(1)));
      } else {
        this.score += 60;
      }
    }

    this.particles.showScorePopup(
      new THREE.Vector3(0, 2.5, 0),
      hitCount > 0 ? `HARMONIC NOVA! ×${hitCount}` : 'HARMONIC NOVA!',
      '#36D6C5'
    );
    this.hud.updateScore(this.score, this.combo);
    return true;
  }

  private onEnemyHit(enemy: Enemy, isPerfect: boolean): void {
    if (enemy.state === 'dying' || enemy.state === 'defeated') return;

    const knockback = isPerfect ? 10.5 : 7.8;
    const defeated = enemy.hit(knockback);
    const pos = enemy.group.position;

    // Flashing lights & shockwave ring on hit!
    this.particles.spawnImpactFlash(
      pos,
      isPerfect ? 0xFFD36E : defeated ? 0x36D6C5 : 0xA68CFF,
      isPerfect ? 5.2 : 3.8,
      isPerfect ? 16 : 11
    );
    this.particles.spawnHitSparks(pos, isPerfect ? 0xFFD36E : 0xFFFFFF, isPerfect ? 14 : 9);
    this.arena.triggerHitPulse();

    if (defeated) {
      this.successfulHits++;
      const isBoss = enemy.type === 'maestro-boss';
      soundSynth.playHitImpact(true, this.combo, isPerfect);
      this.particles.burstConfetti(pos, isBoss ? 36 : 22);
      this.addCameraShake(isBoss ? 0.42 : isPerfect ? 0.24 : 0.14);

      const basePoints = isBoss ? 300 : 100;
      const points = computeHitScore(basePoints, this.combo, isPerfect);
      this.score += points;
      this.combo = Math.min(4.0, Number((this.combo + 0.2).toFixed(1)));

      const chargeGain = isBoss ? 40 : isPerfect ? 30 : 20;
      this.novaSkill.addCharge(chargeGain);

      const label = isBoss ? `MAESTRO! +${points}` : isPerfect ? `PERFECT! +${points}` : `+${points}`;
      this.particles.showScorePopup(pos, label, isPerfect || isBoss ? '#FFD36E' : '#FFFFFF');
    } else {
      // Knockback hit on multi-HP creature!
      soundSynth.playHitImpact(false, this.combo, isPerfect);
      this.addCameraShake(0.2);

      const points = computeHitScore(50, this.combo, isPerfect);
      this.score += points;
      this.novaSkill.addCharge(15);
      this.particles.showScorePopup(pos, `KNOCKBACK! +${points}`, '#D8C7FF');
    }

    this.hud.updateScore(this.score, this.combo);
    this.hud.updateNova(this.novaSkill.progress, this.novaSkill.isReady);
  }

  private updateTargetingAndBeam(): void {
    const livingEnemies = this.enemies.filter(e => e.state !== 'dying' && e.state !== 'defeated');
    if (livingEnemies.length === 0) {
      this.urgentEnemy = null;
      this.hud.setTargetNote(null);
      this.arena.updateChargeBeam(this.guardian.getStaffTipWorldPosition(), null, 0);
      return;
    }

    livingEnemies.sort(
      (a, b) => a.getTimeToImpact(this.arena.protectiveRadius) - b.getTimeToImpact(this.arena.protectiveRadius)
    );
    const mostUrgent = livingEnemies[0];
    this.urgentEnemy = mostUrgent;
    this.hud.setTargetNote(mostUrgent.note);

    const normalizedActive = this.activeCandidateNote ? normalizeNoteName(this.activeCandidateNote) : null;
    let firstMatchingEnemy: Enemy | null = null;

    for (const enemy of livingEnemies) {
      const matches = Boolean(normalizedActive && normalizeNoteName(enemy.note) === normalizedActive);
      if (matches && !firstMatchingEnemy) firstMatchingEnemy = enemy;
      enemy.setTargetVisual(enemy === mostUrgent, matches);
    }

    if (firstMatchingEnemy && this.activeHoldProgress > 0.06) {
      this.guardian.aimAt(firstMatchingEnemy.group.position);
      this.arena.updateChargeBeam(
        this.guardian.getStaffTipWorldPosition(),
        firstMatchingEnemy.group.position,
        this.activeHoldProgress
      );
    } else {
      this.arena.updateChargeBeam(this.guardian.getStaffTipWorldPosition(), null, 0);
    }
  }

  private gameOver(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.activeCandidateNote = null;
    this.activeHoldProgress = 0;
    this.pitchDetector.stopMic({ keepPlayback: this.inputMode === 'piano' });
    soundSynth.playGameOver();

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(`pitch_patrol_best_${this.inputMode}_${this.practiceMode}`, this.bestScore.toString());
      } catch {}
    }

    this.hud.showGameOver(this.score, this.wave, this.bestScore, this.successfulHits);
  }

  private renderLoop = (): void => {
    requestAnimationFrame(this.renderLoop);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.inputMode === 'mic') {
      if (!this.isRunning || this.isPaused) this.pitchDetector.suspendScoring(80);
      this.pitchDetector.update(dt);
      this.hud.updateInputStatus(this.pitchDetector.status);
    }

    this.hud.updatePiano(dt);
    if (this.inputMode === 'piano' && this.isRunning && !this.isPaused) {
      this.activeCandidateNote = this.hud.getActivePianoNote();
      this.activeHoldProgress = this.hud.getPianoHoldProgress();
    }

    this.playerHealth.update(dt);

    if (this.isRunning && !this.isPaused) {
      this.survivalTime += dt;
      this.hud.updateTimer(this.survivalTime);

      if (this.waveEnemiesSpawned < this.waveTotalEnemies && this.enemies.length < 8) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnEnemy();
          this.spawnTimer = this.spawnCooldown;
        }
      } else if (this.enemies.length === 0) {
        this.startWave(this.wave + 1);
      }

      let threatNear = false;
      const boundaryEnemies: Enemy[] = [];

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(dt, this.arena.protectiveRadius);

        const dist = enemy.getDistanceToCenter();
        if (dist <= this.arena.protectiveRadius + 2.2 && enemy.state !== 'dying') {
          threatNear = true;
        }
        if (dist <= this.arena.protectiveRadius + 0.7 && enemy.state !== 'dying' && enemy.state !== 'defeated') {
          boundaryEnemies.push(enemy);
        }
        if (enemy.state === 'defeated') {
          enemy.destroy(this.scene);
          this.enemies.splice(i, 1);
        }
      }

      const minAngle = 0.3;
      for (let i = 0; i < boundaryEnemies.length; i++) {
        for (let j = i + 1; j < boundaryEnemies.length; j++) {
          const e1 = boundaryEnemies[i];
          const e2 = boundaryEnemies[j];
          let diff = e1.getAngle() - e2.getAngle();
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          if (Math.abs(diff) < minAngle && Math.abs(diff) > 0.0001) {
            const push = (minAngle - Math.abs(diff)) * 0.5 * Math.sign(diff);
            e1.setAngle(e1.getAngle() + push * dt * 3.5, e1.getDistanceToCenter());
            e2.setAngle(e2.getAngle() - push * dt * 3.5, e2.getDistanceToCenter());
          }
        }
      }

      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        proj.update(dt, this.scene, this.particles, (targetEnemy, isPerfect) => {
          this.onEnemyHit(targetEnemy, isPerfect);
        });
        if (proj.isFinished) {
          this.projectiles.splice(i, 1);
        }
      }

      this.updateTargetingAndBeam();
      this.arena.update(now * 0.001, threatNear, dt);
    } else {
      this.arena.updateChargeBeam(this.guardian.getStaffTipWorldPosition(), null, 0);
      this.arena.update(now * 0.001, false, dt);
    }

    // Smooth trauma shake on top of dynamic perspective camera
    if (this.shakeIntensity > 0.005) {
      this.camera.position.set(
        this.baseCameraPos.x + (Math.random() - 0.5) * this.shakeIntensity * 2.2,
        this.baseCameraPos.y + (Math.random() - 0.5) * this.shakeIntensity * 1.4,
        this.baseCameraPos.z + (Math.random() - 0.5) * this.shakeIntensity * 1.6
      );
      this.shakeIntensity *= Math.exp(-10 * dt);
    } else {
      this.shakeIntensity = 0;
      this.camera.position.copy(this.baseCameraPos);
    }

    this.guardian.setChargeState(this.activeHoldProgress, this.novaSkill.isReady);
    this.guardian.update(now * 0.001, dt, this.playerHealth.isInvulnerable);
    this.particles.update(dt);

    this.renderer.render(this.scene, this.camera);
  };
}
