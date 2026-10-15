/**
 * Pitch Patrol - Comprehensive Game Engine
 * 3D Top-Down Arena with Health Survival, Intentional Pitch Matching, and Piano Isolation.
 */

import * as THREE from 'three';
import { Arena } from './arena';
import { Guardian } from './guardian';
import { Enemy, EnemyType } from './enemies';
import { Projectile } from './projectiles';
import { ParticleSystem } from './particles';
import { PlayerHealth } from './player-health';
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
  private camera!: THREE.OrthographicCamera;

  private arena!: Arena;
  private guardian!: Guardian;
  private particles!: ParticleSystem;
  private playerHealth!: PlayerHealth;
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
  private totalAttacksFired = 0;
  private successfulHits = 0;

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private urgentEnemy: Enemy | null = null;

  // Spawner state
  private waveEnemiesSpawned = 0;
  private waveTotalEnemies = 5;
  private spawnCooldown = 1.8;
  private spawnTimer = 0;

  // Frustum bounds for 22-unit expanded arena
  private readonly frustumSize = 52;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.canvas = canvas;
    this.pitchDetector = new PitchDetector();
    this.playerHealth = new PlayerHealth();

    try {
      this.bestScore = parseInt(localStorage.getItem('pitch_patrol_best_score') || '0', 10);
    } catch {
      this.bestScore = 0;
    }

    this.initThree();
    this.initHUD(uiContainer);
    this.setupHealthCallbacks();
    this.setupPitchCallbacks();
    this.setupResize();

    this.lastTime = performance.now();
    this.renderLoop();
  }

  private initThree(): void {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xA9CEF4); // Cheerful sky
    this.scene.fog = new THREE.FogExp2(0xA9CEF4, 0.012);

    // 2. Camera: 65° Orthographic Top-Down
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      120
    );

    this.camera.position.set(0, 48, 30);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Subsystems
    this.arena = new Arena(this.scene);
    this.guardian = new Guardian(this.scene);
    this.particles = new ParticleSystem(this.scene);
  }

  private initHUD(uiContainer: HTMLElement): void {
    this.hud = new HUD(uiContainer, {
      onStartGame: () => this.startGame(),
      onRestartGame: () => this.restartGame(),
      onTogglePause: () => this.togglePause(),
      onToggleMic: async () => {
        return await this.pitchDetector.initMic();
      },
      onCalibrateNoise: async (onProgress) => {
        return await this.pitchDetector.calibrateNoiseFloor(onProgress);
      },
      onPianoAttack: (note: string) => {
        // Only authorize damage if in piano mode
        if (this.inputMode === 'piano') {
          this.executeAuthorizedAttack(note);
        }
      },
      onPianoNoteDown: (note: string) => {
        soundSynth.startPianoNote(note);
      },
      onPianoNoteUp: (note: string) => {
        soundSynth.stopPianoNote(note);
      },
      onChangeInputMode: (mode: GameInputMode) => {
        this.inputMode = mode;
        if (mode === 'piano') {
          this.pitchDetector.stopMic();
        }
      },
      onUpdateTolerance: (cents: number) => {
        this.pitchDetector.stateMachine.setTolerance(cents);
      },
      onUpdateSensitivity: (mult: number) => {
        this.pitchDetector.inputSensitivity = mult;
      },
      onToggleReducedMotion: (enabled: boolean) => {
        this.isReducedMotion = enabled;
      }
    });

    this.hud.updateHealth(this.playerHealth.currentHp, this.playerHealth.maxHp);
  }

  private setupHealthCallbacks(): void {
    this.playerHealth.onHealthChange = (hp, maxHp) => {
      this.hud.updateHealth(hp, maxHp);
    };

    this.playerHealth.onDamageTaken = (_amount, remainingHp) => {
      soundSynth.playPlayerDamage();
      this.guardian.triggerDamageFeedback();
      this.arena.triggerDamageFlash();
      if (!this.isReducedMotion) {
        this.triggerCameraShake();
      }
      if (remainingHp <= 0) {
        this.gameOver();
      }
    };

    this.playerHealth.onDeath = () => {
      this.gameOver();
    };
  }

  private setupPitchCallbacks(): void {
    // Only validated intentional attacks from the state machine authorize attacks
    this.pitchDetector.onAttackAuthorized = (note: string) => {
      if (this.inputMode === 'mic') {
        this.executeAuthorizedAttack(note);
      }
    };

    this.pitchDetector.onPitchUpdate = (result: PitchDetectionResult | null) => {
      if (this.inputMode === 'mic') {
        this.hud.updatePitchDisplay(result);
      }
    };
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.left = (-this.frustumSize * aspect) / 2;
      this.camera.right = (this.frustumSize * aspect) / 2;
      this.camera.top = this.frustumSize / 2;
      this.camera.bottom = -this.frustumSize / 2;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public startGame(): void {
    this.isRunning = true;
    this.isPaused = false;
    this.score = 0;
    this.totalAttacksFired = 0;
    this.successfulHits = 0;
    this.combo = 1.0;
    this.wave = 1;
    this.survivalTime = 0;
    this.playerHealth.reset();
    this.clearAllEnemies();
    this.startWave(1);
    this.hud.updateScore(this.score, this.combo);
    this.hud.updateWave(this.wave);
    this.hud.updateHealth(this.playerHealth.currentHp, this.playerHealth.maxHp);
  }

  public restartGame(): void {
    this.clearAllEnemies();
    this.startGame();
  }

  public togglePause(): void {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    this.hud.showPause(this.isPaused);
  }

  private startWave(waveNum: number): void {
    this.wave = waveNum;
    this.waveEnemiesSpawned = 0;
    this.waveTotalEnemies = 4 + waveNum * 3;
    this.spawnCooldown = Math.max(0.9, 2.5 - waveNum * 0.12);
    this.spawnTimer = 0.5;
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
  }

  private spawnEnemy(): void {
    // Pick scale pool based on wave progression
    let pool = SCALE_WAVE_1_2;
    if (this.wave >= 5) pool = SCALE_WAVE_5_PLUS;
    else if (this.wave >= 3) pool = SCALE_WAVE_3_4;

    const rawNote = pool[Math.floor(Math.random() * pool.length)];
    const note = normalizeNoteName(rawNote);

    // Enemy type weighting
    const rand = Math.random();
    let type: EnemyType = 'note-sprite';
    let speed = 1.7 + (this.wave - 1) * 0.1;
    let damage = 10;

    if (rand < 0.45) {
      type = 'note-sprite';
      speed = 1.7 + (this.wave - 1) * 0.1;
      damage = 10;
    } else if (rand < 0.75) {
      type = 'metronome-runner';
      speed = 2.8 + (this.wave - 1) * 0.15;
      damage = 8;
    } else if (rand < 0.90) {
      type = 'bass-blob';
      speed = 1.1 + (this.wave - 1) * 0.08;
      damage = 15; // Tanky strike
    } else {
      type = 'chord-cloud';
      speed = 1.4 + (this.wave - 1) * 0.1;
      damage = 12;
    }

    // Distribute spawn angle
    const spawnAngle = Math.random() * Math.PI * 2;
    const enemy = new Enemy(
      this.scene,
      { type, note, speed, spawnAngle, damage },
      this.arena.stageRadius
    );

    // Hook up boundary attack impact
    enemy.onAttackImpact = (_atkEnemy, dmg) => {
      this.playerHealth.takeDamage(dmg);
    };

    this.enemies.push(enemy);
    this.waveEnemiesSpawned++;
  }

  /**
   * Only called when an attack is strictly validated by mic state machine or deliberate piano play
   */
  public executeAuthorizedAttack(matchedNote: string): void {
    if (!this.isRunning || this.isPaused) return;

    this.totalAttacksFired++;
    const normalizedMatch = normalizeNoteName(matchedNote);

    // Filter living matching enemies (including those currently attacking the boundary!)
    const matchingEnemies = this.enemies.filter(
      e => e.state !== 'dying' && e.state !== 'defeated' && normalizeNoteName(e.note) === normalizedMatch
    );

    if (matchingEnemies.length === 0) return;

    // Smart Targeting: Prioritize living enemies that are NOT already targeted by an in-flight projectile
    const untargeted = matchingEnemies.filter(e => !e.isTargetedByProjectile);
    const candidateList = untargeted.length > 0 ? untargeted : matchingEnemies;

    // Prioritize lowest time to impact
    candidateList.sort(
      (a, b) => a.getTimeToImpact(this.arena.protectiveRadius) - b.getTimeToImpact(this.arena.protectiveRadius)
    );
    const target = candidateList[0];
    target.isTargetedByProjectile = true;

    // Guardian aim & attack animation
    this.guardian.aimAt(target.group.position);
    this.guardian.triggerAttack();

    // Sound
    soundSynth.playPulse(matchedNote);
    // Briefly suspend mic scoring during pulse sound to prevent speaker loop hits
    this.pitchDetector.suspendScoring(220);

    // Fire 3D Projectile
    const staffTipPos = this.guardian.getStaffTipWorldPosition();
    const projectile = new Projectile(this.scene, staffTipPos, target);
    this.projectiles.push(projectile);
  }

  private onEnemyHarmonized(enemy: Enemy): void {
    if (enemy.state === 'dying' || enemy.state === 'defeated') return;
    enemy.hit();
    this.successfulHits++;

    // Sound & particles
    soundSynth.playDefeat(this.combo);
    this.particles.burstConfetti(enemy.group.position);

    // Score & Combo
    const basePoints = 100;
    const points = Math.round(basePoints * this.combo);
    this.score += points;
    this.combo = Math.min(4.0, this.combo + 0.2);

    this.particles.showScorePopup(enemy.group.position, `+${points}`);
    this.hud.updateScore(this.score, this.combo);
  }

  private updateUrgentThreat(): void {
    const livingEnemies = this.enemies.filter(e => e.state !== 'dying' && e.state !== 'defeated');
    if (livingEnemies.length === 0) {
      this.urgentEnemy = null;
      this.hud.setTargetNote(null);
      return;
    }

    // Sort by shortest time to impact
    livingEnemies.sort(
      (a, b) => a.getTimeToImpact(this.arena.protectiveRadius) - b.getTimeToImpact(this.arena.protectiveRadius)
    );
    const mostUrgent = livingEnemies[0];

    if (this.urgentEnemy !== mostUrgent) {
      if (this.urgentEnemy) this.urgentEnemy.badge.setTargeted(false);
      mostUrgent.badge.setTargeted(true);
      this.urgentEnemy = mostUrgent;
      this.hud.setTargetNote(mostUrgent.note);
    }
  }

  private triggerCameraShake(): void {
    const origY = 48;
    const origZ = 30;
    let elapsed = 0;
    const shake = () => {
      elapsed += 0.016;
      if (elapsed < 0.25) {
        this.camera.position.y = origY + (Math.random() - 0.5) * 0.7;
        this.camera.position.z = origZ + (Math.random() - 0.5) * 0.7;
        requestAnimationFrame(shake);
      } else {
        this.camera.position.y = origY;
        this.camera.position.z = origZ;
      }
    };
    shake();
  }

  private gameOver(): void {
    this.isRunning = false;
    soundSynth.playGameOver();

    const accuracy = this.totalAttacksFired > 0
      ? Math.round((this.successfulHits / this.totalAttacksFired) * 100)
      : 100;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem('pitch_patrol_best_score', this.bestScore.toString());
      } catch {}
    }

    this.hud.showGameOver(this.score, this.wave, this.bestScore, accuracy);
  }

  private renderLoop = (): void => {
    requestAnimationFrame(this.renderLoop);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Pitch detector audio buffer update (only if in mic mode)
    if (this.inputMode === 'mic') {
      this.pitchDetector.update(dt);
    }

    // Player health timer update
    this.playerHealth.update(dt);

    if (this.isRunning && !this.isPaused) {
      this.survivalTime += dt;
      this.hud.updateTimer(this.survivalTime);

      // Spawner logic
      if (this.waveEnemiesSpawned < this.waveTotalEnemies) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnEnemy();
          this.spawnTimer = this.spawnCooldown;
        }
      } else if (this.enemies.length === 0) {
        // Next wave!
        this.startWave(this.wave + 1);
      }

      // Update Enemies
      let threatNear = false;
      const boundaryEnemies: Enemy[] = [];

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        enemy.update(dt, this.arena.protectiveRadius);

        const dist = enemy.getDistanceToCenter();
        if (dist <= this.arena.protectiveRadius + 2.0 && enemy.state !== 'dying') {
          threatNear = true;
          if (Math.random() < 0.02) soundSynth.playProximityWarning();
        }

        if (dist <= this.arena.protectiveRadius + 0.6 && enemy.state !== 'dying' && enemy.state !== 'defeated') {
          boundaryEnemies.push(enemy);
        }

        // Clean up defeated
        if (enemy.state === 'defeated') {
          enemy.destroy(this.scene);
          this.enemies.splice(i, 1);
        }
      }

      // Boundary radial separation (prevents enemies from stacking on top of each other)
      const minAngle = 0.28; // ~16 degrees minimum separation along ring
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

      // Update Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        proj.update(dt, this.scene, (targetEnemy) => {
          this.onEnemyHarmonized(targetEnemy);
        });
        if (proj.isFinished) {
          this.projectiles.splice(i, 1);
        }
      }

      this.updateUrgentThreat();
      this.arena.update(now * 0.001, threatNear, dt);
    } else {
      this.arena.update(now * 0.001, false, dt);
    }

    this.guardian.update(now * 0.001, dt, this.playerHealth.isInvulnerable);
    this.particles.update(dt);

    this.renderer.render(this.scene, this.camera);
  };
}
