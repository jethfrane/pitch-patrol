/**
 * Pitch Patrol - Intentional Pitch Matching State Machine
 * 
 * Separates raw frequency estimates from validated, authorized attack events.
 * Implements: Listening -> Candidate -> StableHold -> ValidatedAttack -> Rearm
 */

export interface PitchMatchConfig {
  toleranceCents: number; // e.g. ±35 cents
  requiredHoldMs: number; // e.g. 280-320 ms
  dropoutGraceMs: number; // e.g. 60 ms
  rearmCooldownMs: number; // e.g. 250 ms after attack before same note can fire again
  minConfidence: number; // e.g. 0.80 autocorrelation peak clarity
}

export type MatchState = 'listening' | 'candidate' | 'holding' | 'attack' | 'rearm';

export interface StateMachineStatus {
  state: MatchState;
  candidateNote: string | null;
  centsOffset: number;
  holdProgress: number; // 0.0 to 1.0
  inTune: boolean;
  canAttack: boolean;
}

export class PitchMatchStateMachine {
  private config: PitchMatchConfig;

  private state: MatchState = 'listening';
  private candidateNote: string | null = null;
  private candidateOctave = 4;
  private holdTimerMs = 0;
  private dropoutTimerMs = 0;
  private rearmTimerMs = 0;
  private lastCents = 0;

  // Callback fired once when an attack is strictly validated
  public onAttackAuthorized?: (note: string, octave: number) => void;

  constructor(config?: Partial<PitchMatchConfig>) {
    this.config = {
      toleranceCents: 35,
      requiredHoldMs: 280,
      dropoutGraceMs: 60,
      rearmCooldownMs: 250,
      minConfidence: 0.80,
      ...config
    };
  }

  public setTolerance(cents: number): void {
    this.config.toleranceCents = cents;
  }

  public setHoldDuration(ms: number): void {
    this.config.requiredHoldMs = ms;
  }

  /**
   * Process a frame of pitch detection
   * @param detectedNote Note name (e.g. "C", "F♯") or null if silence/unvoiced
   * @param cents Offset from ideal pitch (-50 to +50)
   * @param confidence Autocorrelation confidence (0 to 1)
   * @param dt Delta time in seconds
   */
  public update(
    detectedNote: string | null,
    octave: number,
    cents: number,
    confidence: number,
    dt: number
  ): StateMachineStatus {
    const dtMs = dt * 1000;

    // Handle Rearm Cooldown first
    if (this.state === 'rearm') {
      this.rearmTimerMs -= dtMs;
      if (this.rearmTimerMs <= 0) {
        // Rearmed. If user released or changed note, return to listening
        if (!detectedNote || detectedNote !== this.candidateNote) {
          this.state = 'listening';
          this.candidateNote = null;
          this.holdTimerMs = 0;
        } else {
          // Player is still holding the same note; require fresh re-attack hold window
          this.state = 'candidate';
          this.holdTimerMs = 0;
        }
      }
      return this.getStatus(false);
    }

    // Check if input is valid, confident, and in-tune
    const isValidInput = detectedNote !== null && confidence >= this.config.minConfidence;
    const isInTune = isValidInput && Math.abs(cents) <= this.config.toleranceCents;

    if (isInTune && detectedNote) {
      this.lastCents = cents;

      if (this.candidateNote === detectedNote) {
        // Sustaining current candidate
        this.dropoutTimerMs = 0;
        this.holdTimerMs += dtMs;
        this.state = 'holding';

        if (this.holdTimerMs >= this.config.requiredHoldMs) {
          // VALIDATED ATTACK TRIGGERED!
          this.state = 'attack';
          if (this.onAttackAuthorized) {
            this.onAttackAuthorized(this.candidateNote, this.candidateOctave);
          }
          // Enter Rearm state immediately to prevent rapid-fire auto-win
          this.state = 'rearm';
          this.rearmTimerMs = this.config.rearmCooldownMs;
          this.holdTimerMs = 0;
          return this.getStatus(true);
        }
      } else {
        // Candidate switched to a new note -> reset hold progress completely
        this.candidateNote = detectedNote;
        this.candidateOctave = octave;
        this.holdTimerMs = dtMs; // Start hold from scratch
        this.dropoutTimerMs = 0;
        this.state = 'candidate';
      }
    } else {
      // In dropout or out of tune
      if (this.state === 'holding' || this.state === 'candidate') {
        this.dropoutTimerMs += dtMs;
        // Dropout grace window: keep candidate briefly, but DO NOT accumulate hold time
        if (this.dropoutTimerMs > this.config.dropoutGraceMs) {
          this.state = 'listening';
          this.candidateNote = null;
          this.holdTimerMs = 0;
          this.dropoutTimerMs = 0;
        }
      } else {
        this.state = 'listening';
        this.candidateNote = null;
        this.holdTimerMs = 0;
      }
    }

    return this.getStatus(false);
  }

  private getStatus(canAttack: boolean): StateMachineStatus {
    const progress = Math.min(1.0, this.holdTimerMs / this.config.requiredHoldMs);
    return {
      state: this.state,
      candidateNote: this.candidateNote,
      centsOffset: this.lastCents,
      holdProgress: progress,
      inTune: Math.abs(this.lastCents) <= this.config.toleranceCents,
      canAttack
    };
  }

  public reset(): void {
    this.state = 'listening';
    this.candidateNote = null;
    this.holdTimerMs = 0;
    this.dropoutTimerMs = 0;
    this.rearmTimerMs = 0;
  }
}
