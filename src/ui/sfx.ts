/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SFX — synthesised, silent by default, and never a reason the game stalls.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE FAILURE THIS FILE PREVENTS (1): AN AD UNIT THAT MAKES NOISE UNPROMPTED.
 * This game ships inside an ad slot. A person opens it on a train, and a jingle
 * plays. They do not turn the volume down — they close the tab, and the
 * impression is worse than wasted. So `muted` DEFAULTS TO TRUE and lives in the
 * save file. Sound is something a player turns ON, which also means the players
 * who have it on are the ones who wanted it.
 *
 * THE FAILURE THIS FILE PREVENTS (2): THE FIRST SOUND THAT NEVER PLAYS. An
 * AudioContext constructed at module load, before any user gesture, is created
 * in the `suspended` state on every current browser. Nothing throws; the first
 * few effects are simply swallowed, and the bug reproduces only on a cold load,
 * which is the one case nobody re-tests. So the context is created LAZILY on the
 * first real gesture, and `resume()` is attempted on every play in case the
 * browser suspended it again on a tab switch.
 *
 * THE FAILURE THIS FILE PREVENTS (3): the audio graph that outlives the sound.
 * Every voice here is built, scheduled, and left to be collected — but a barrel
 * storm can ask for a dozen effects inside one frame, and each one is a handful
 * of nodes on the audio thread. VOICE_CAP is a hard ceiling: past it, new
 * requests are DROPPED rather than queued. A dropped sound is inaudible in a
 * pile of eleven others; a queued one arrives late, which is audibly wrong.
 *
 * NO AUDIO FILES. Not for size — for latency and for failure modes. A decoded
 * buffer has a fetch, a decode, a cache and a 404 in front of it; an oscillator
 * has none of those, and a jump cue that arrives 200ms after the jump is worse
 * than no jump cue at all.
 */

import type { SaveData } from '../core/types';

export type SfxName =
  | 'jump'
  | 'land'
  | 'rakhi'
  | 'unlock'
  | 'smash'
  | 'hit'
  | 'levelClear'
  | 'timeWarn'
  | 'uiTap';

/**
 * Concurrent voices. Eight is past what a human can separate and well inside
 * what a mid-tier phone's audio thread will mix without glitching.
 */
const VOICE_CAP = 8;

/**
 * Master trim. Everything below is authored relative to this, so "the game is
 * too loud" is one number rather than nine.
 */
const MASTER = 0.22;

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = 0;
  private _muted: boolean;

  /**
   * `persist` is handed in rather than imported, so this file knows nothing
   * about the save key or the storage module — the same reason core/storage.ts
   * takes its key as an argument.
   */
  constructor(
    private readonly save: SaveData,
    private readonly persist: () => void,
  ) {
    this._muted = save.muted;
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(v: boolean): void {
    if (this._muted === v) return;
    this._muted = v;
    this.save.muted = v;
    this.persist();
    if (this.master && this.ctx) {
      // Ramped rather than stepped: an instantaneous gain change on a running
      // oscillator is a click, and a click is the one artefact that makes
      // synthesised audio sound broken rather than simple.
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(v ? 0 : MASTER, t, 0.01);
    }
  }

  /** Returns the new state, for a button that wants to relabel itself. */
  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /**
   * Call from the FIRST user gesture of the session — a pointerdown, a keydown.
   * Safe to call repeatedly; it is a no-op once the context exists and running.
   *
   * Deliberately NOT called from the constructor. See failure (2).
   */
  unlock(): void {
    this.ensure();
  }

  /**
   * Discard the graph. On teardown only — an AudioContext is a real OS resource
   * and a page that opens several without closing them eventually gets refused.
   */
  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.voices = 0;
    void ctx?.close().catch(() => {
      /* Already closed, or never opened. Nothing to recover. */
    });
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      // A tab switch, or iOS taking a phone call, suspends the context out from
      // under us. Resuming is cheap and the promise is deliberately unhandled:
      // a rejected resume means audio is unavailable, which is not an error
      // worth surfacing anywhere.
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return this.ctx;
    }

    // `webkitAudioContext` is still the only constructor on older iOS WebViews.
    const Ctor =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : ((globalThis as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext ?? null);
    if (!Ctor) return null;

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      // Some embedded browsers refuse outright. Silence is a fine outcome.
      return null;
    }

    const master = ctx.createGain();
    master.gain.value = this._muted ? 0 : MASTER;
    master.connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    return ctx;
  }

  // ── Voices ────────────────────────────────────────────────────────────────

  /**
   * One enveloped oscillator. `t0` is an offset from now, in seconds, which is
   * how the arpeggios below are scheduled without a single timer.
   *
   * The envelope is exponential on the way down because linear decay on a tone
   * sounds like a switch being thrown; `0.0001` rather than `0` because
   * `exponentialRampToValueAtTime` is undefined at zero and throws.
   */
  private tone(
    wave: Wave,
    freq: number,
    dur: number,
    gain: number,
    t0 = 0,
    freqTo?: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (this.voices >= VOICE_CAP) return;

    const start = ctx.currentTime + t0;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, start);
    if (freqTo !== undefined) osc.frequency.exponentialRampToValueAtTime(freqTo, start + dur);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.012, dur * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(env);
    env.connect(master);

    this.voices++;
    osc.onended = (): void => {
      this.voices--;
      osc.disconnect();
      env.disconnect();
    };
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /**
   * Filtered white noise — the percussive half of the vocabulary. A smash and a
   * land are broadband events; an oscillator cannot express either, and a
   * bandpassed noise burst is four nodes and no assets.
   */
  private noise(dur: number, gain: number, centre: number, q = 1): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (this.voices >= VOICE_CAP) return;

    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centre;
    filter.Q.value = q;

    const env = ctx.createGain();
    const start = ctx.currentTime;
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(master);

    this.voices++;
    src.onended = (): void => {
      this.voices--;
      src.disconnect();
      filter.disconnect();
      env.disconnect();
    };
    src.start(start);
    src.stop(start + dur);
  }

  // ── The cues ──────────────────────────────────────────────────────────────

  /**
   * Play one effect. Cheap and total: muted, no context, or capped all return
   * without doing anything, so no call site anywhere needs a guard.
   *
   * The frequencies are a pentatonic set on purpose. The game fires pickups in
   * rapid chains, and any two notes from a pentatonic scale are consonant — so a
   * chain never produces the accidental minor second that reads as "wrong note"
   * rather than as a sound effect.
   */
  play(name: SfxName): void {
    if (this._muted) return;
    if (!this.ensure()) return;

    switch (name) {
      case 'jump':
        // Rising, short. The pitch goes the way the body goes.
        this.tone('square', 320, 0.13, 0.5, 0, 620);
        break;

      case 'land':
        // A body arriving, not a note: a low thud under a short noise tap.
        this.tone('sine', 180, 0.09, 0.45, 0, 90);
        this.noise(0.05, 0.16, 900, 0.8);
        break;

      case 'rakhi':
        // Three-note rising arpeggio. Consonant with itself at any chain speed.
        this.tone('triangle', 784, 0.09, 0.4, 0);
        this.tone('triangle', 988, 0.09, 0.4, 0.055);
        this.tone('triangle', 1318, 0.14, 0.42, 0.11);
        break;

      case 'unlock':
        // The same figure, one note longer and an octave wider. Deliberately the
        // SAME SHAPE as `rakhi`: the unlock is what the rakhis were for, and the
        // player should hear the relationship without being told about it.
        this.tone('triangle', 523, 0.12, 0.45, 0);
        this.tone('triangle', 659, 0.12, 0.45, 0.07);
        this.tone('triangle', 784, 0.12, 0.45, 0.14);
        this.tone('triangle', 1046, 0.3, 0.5, 0.21);
        break;

      case 'smash':
        this.noise(0.16, 0.34, 420, 0.6);
        this.tone('sawtooth', 220, 0.12, 0.3, 0, 70);
        break;

      case 'hit':
        // Falling, harsh, and the only sawtooth in the set. A death has to be
        // instantly separable from every reward cue at any volume.
        this.tone('sawtooth', 360, 0.34, 0.5, 0, 70);
        this.noise(0.1, 0.2, 300, 0.5);
        break;

      case 'levelClear':
        this.tone('triangle', 659, 0.13, 0.4, 0);
        this.tone('triangle', 880, 0.13, 0.4, 0.1);
        this.tone('triangle', 1046, 0.13, 0.4, 0.2);
        this.tone('triangle', 1318, 0.36, 0.46, 0.3);
        break;

      case 'timeWarn':
        // Two dry ticks. A clock, not a melody — a tune here would compete with
        // the reward cues at exactly the moment the player needs to hear them.
        this.tone('square', 880, 0.06, 0.3, 0);
        this.tone('square', 880, 0.06, 0.3, 0.16);
        break;

      case 'uiTap':
        this.tone('sine', 660, 0.05, 0.24, 0);
        break;
    }
  }
}
