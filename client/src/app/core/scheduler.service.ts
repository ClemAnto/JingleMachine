import { Injectable, NgZone, Signal, inject, signal } from '@angular/core';

import { Jingle } from './library.service';
import { MixerService } from './mixer.service';
import { PlaybackService } from './playback.service';
import { ScheduledJingle, ScheduleService } from './schedule.service';

/** A scheduled entry paired with the jingle it should play. */
export interface SchedulerEntry {
  entry: ScheduledJingle;
  jingle: Jingle | undefined;
}

/** What the toast shows: the 10s warning countdown, then the live playback. */
export interface PendingFire {
  occKey: string;
  jingleName: string;
  phase: 'countdown' | 'playing';
  secondsLeft: number; // countdown: seconds to fire · playing: seconds left to play
  progress: number;    // 0–100, "time draining" bar in both phases
}

interface OccState {
  armed: boolean;       // the lead window was entered (so a surprise past-time never fires)
  cancelled: boolean;   // user blocked this occurrence from the toast
  fired: boolean;       // already handled
  targetMs: number;     // for cleanup
  playable?: boolean;   // whether THIS instance should play (browser vs standalone); resolved once
  resolving?: boolean;
}

/** Seconds of warning before a scheduled jingle plays. */
const LEAD_MS = 10_000;
/** How often we check the clock. Runs outside Angular → no idle change detection. */
const TICK_MS = 250;

/**
 * Plays scheduled jingles when their time strikes — but ONLY while the app is
 * open (a web page cannot play audio in the background once closed). Ten seconds
 * before firing it raises `pending` (a countdown toast with a "Blocca" button);
 * the toast then stays for the whole playback (showing progress + "Interrompi")
 * until the jingle ends or is stopped. If the entry disappears mid-countdown
 * (jingle/schedule deleted) it drops out of the live `entries` signal, so the
 * toast clears itself.
 */
@Injectable({ providedIn: 'root' })
export class SchedulerService {
  private readonly scheduleService = inject(ScheduleService);
  private readonly mixer = inject(MixerService);
  private readonly playback = inject(PlaybackService);
  private readonly zone = inject(NgZone);

  private timer: ReturnType<typeof setInterval> | null = null;
  private worker: Worker | null = null;
  private readonly audio = new Audio();
  private readonly occ = new Map<string, OccState>();

  // Two independent sources for the toast; `playing` wins while audio is going.
  private countdownPending: PendingFire | null = null;
  private playingPending: PendingFire | null = null;

  /** What the toast renders (countdown or live playback), or null when idle. */
  readonly pending = signal<PendingFire | null>(null);

  constructor() {
    this.audio.addEventListener('timeupdate', () => this.onAudioProgress());
    this.audio.addEventListener('ended', () => this.onAudioEnded());
    // Report activity so the voice trigger can inhibit itself while audio plays.
    this.audio.addEventListener('play', () => this.playback.begin(this));
    this.audio.addEventListener('pause', () => this.playback.end(this));
  }

  start(entries: Signal<SchedulerEntry[]>): void {
    this.stop();
    const run = () => this.tick(entries());
    // Outside Angular: the bare tick must not trigger change detection. We hop
    // back into the zone only when something the view cares about changes.
    // Background tabs throttle setInterval to ~1/min (frozen countdown, late
    // firing); a Web Worker timer isn't throttled that way, so we drive ticks
    // from a tiny inline worker, falling back to setInterval if unavailable.
    this.zone.runOutsideAngular(() => {
      this.worker = createTickerWorker(TICK_MS, run);
      if (!this.worker) this.timer = setInterval(run, TICK_MS);
    });
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.audio.pause();
    this.countdownPending = null;
    this.playingPending = null;
    this.pending.set(null);
  }

  /** Toast button: blocks the imminent fire (countdown) or stops it (playing). */
  cancel(): void {
    const current = this.pending();
    if (!current) return;
    if (current.phase === 'playing') {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.playingPending = null;
    } else {
      const state = this.occ.get(current.occKey);
      if (state) state.cancelled = true;
      this.countdownPending = null;
    }
    this.refreshPending();
  }

  private tick(entries: SchedulerEntry[]): void {
    const now = Date.now();
    const dayKey = new Date(now).toDateString();

    let imminent: PendingFire | null = null;
    const toPlay: { jingle: Jingle; occKey: string }[] = [];
    const toRemove: string[] = [];

    for (const { entry, jingle } of entries) {
      if (!jingle?.audioUrl) continue; // orphan / not playable
      if (entry.enabled === false) continue; // paused → never fires (also clears any toast)
      const targetMs = targetToday(entry.time, now);
      const msUntil = targetMs - now;
      const occKey = `${entry.id}@${dayKey} ${entry.time}`;

      if (msUntil > 0 && msUntil <= LEAD_MS) {
        // Lead window: arm + surface the soonest countdown.
        const state = this.ensure(occKey, targetMs);
        state.armed = true;
        this.resolvePlayable(state);
        // Only the instance that will actually play shows the toast.
        if (state.playable && !state.cancelled) {
          const candidate: PendingFire = {
            occKey,
            jingleName: jingle.name,
            phase: 'countdown',
            secondsLeft: Math.ceil(msUntil / 1000),
            progress: (msUntil / LEAD_MS) * 100,
          };
          if (!imminent || candidate.secondsLeft < imminent.secondsLeft) imminent = candidate;
        }
      } else if (msUntil <= 0 && msUntil > -60_000) {
        // Fire window: only if it was armed (so a just-scheduled past time can't fire)
        // and we know whether this instance is the one that should play.
        const state = this.occ.get(occKey);
        if (state?.armed && state.playable !== undefined && !state.fired) {
          state.fired = true;
          if (state.playable && !state.cancelled) toPlay.push({ jingle, occKey });
          // Only the playing instance consumes a one-shot (keeps Firestore tidy).
          if (state.playable && !entry.repeatDaily) toRemove.push(entry.id);
        }
      }
    }

    this.cleanup(now);

    // Audio has no view state → safe to start outside the zone.
    for (const item of toPlay) this.play(item.jingle, item.occKey);

    this.countdownPending = imminent;

    // Touch Angular only when the view actually changes.
    const next = this.playingPending ?? this.countdownPending;
    if (!samePending(this.pending(), next) || toRemove.length > 0) {
      this.zone.run(() => {
        this.pending.set(next);
        for (const id of toRemove) void this.scheduleService.remove(id);
      });
    }
  }

  /** Decides whether THIS instance should play, to avoid double audio when a
   *  browser tab and the standalone app are both open on the same machine: the
   *  standalone always plays; a browser plays only if no Mixer (i.e. no
   *  standalone) answers. Resolved once per occurrence (10s before firing). */
  private resolvePlayable(state: OccState): void {
    if (state.playable !== undefined || state.resolving) return;
    if (this.mixer.isStandalone) {
      state.playable = true;
      return;
    }
    state.resolving = true;
    this.mixer.health().then((health) => {
      state.playable = health === null;
      state.resolving = false;
    });
  }

  private play(jingle: Jingle, occKey: string): void {
    this.audio.src = jingle.audioUrl;
    this.audio.volume = (jingle.volume ?? 100) / 100;
    this.audio.currentTime = 0;
    // The toast switches to the "playing" phase and stays until the audio ends.
    this.playingPending = {
      occKey,
      jingleName: jingle.name,
      phase: 'playing',
      secondsLeft: 0,
      progress: 100,
    };
    // Autoplay needs a prior user gesture; after login + clicks that holds.
    this.audio.play().catch((err) => {
      console.warn('Scheduled playback blocked/failed:', err);
      this.playingPending = null;
      this.refreshPending();
    });
  }

  private onAudioProgress(): void {
    if (!this.playingPending) return;
    const { duration, currentTime } = this.audio;
    const remaining = duration ? duration - currentTime : 0;
    this.playingPending = {
      ...this.playingPending,
      secondsLeft: Math.ceil(remaining),
      progress: duration ? (remaining / duration) * 100 : 100,
    };
    this.refreshPending();
  }

  private onAudioEnded(): void {
    this.playingPending = null;
    this.playback.end(this);
    this.refreshPending();
  }

  /** Pushes the current toast state into the signal (used from audio events). */
  private refreshPending(): void {
    const next = this.playingPending ?? this.countdownPending;
    if (!samePending(this.pending(), next)) this.zone.run(() => this.pending.set(next));
  }

  private ensure(occKey: string, targetMs: number): OccState {
    let state = this.occ.get(occKey);
    if (!state) {
      state = { armed: false, cancelled: false, fired: false, targetMs };
      this.occ.set(occKey, state);
    }
    return state;
  }

  private cleanup(now: number): void {
    for (const [key, state] of this.occ) {
      if (now > state.targetMs + 60_000) this.occ.delete(key);
    }
  }
}

/** Drives ticks from a Web Worker (immune to background-tab timer throttling).
 *  Returns null if Workers are unavailable → caller falls back to setInterval. */
function createTickerWorker(intervalMs: number, onTick: () => void): Worker | null {
  try {
    if (typeof Worker === 'undefined') return null;
    const code =
      'let h=null;onmessage=function(e){' +
      'if(e.data&&e.data.interval){h=setInterval(function(){postMessage(0)},e.data.interval);}' +
      'else{clearInterval(h);h=null;}};';
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = () => onTick();
    worker.postMessage({ interval: intervalMs });
    return worker;
  } catch {
    return null;
  }
}

/** Today's timestamp for a "HH:mm:ss" (or legacy "HH:mm") wall-clock time. */
function targetToday(time: string, nowMs: number): number {
  const [h, m, s] = time.split(':').map(Number);
  const date = new Date(nowMs);
  date.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
  return date.getTime();
}

function samePending(a: PendingFire | null, b: PendingFire | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.occKey === b.occKey &&
    a.phase === b.phase &&
    a.secondsLeft === b.secondsLeft &&
    a.progress === b.progress
  );
}
