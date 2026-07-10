import { Injectable, Signal, effect, inject, signal } from '@angular/core';
// Type-only import (erased at build): the 5.6 MB runtime is loaded lazily in
// startEngine() via dynamic import, so it never bloats the initial bundle.
import type { KaldiRecognizer, Model } from 'vosk-browser';

import { environment } from '../../environments/environment';
import { Jingle } from './library.service';
import { LeaderService } from './leader.service';
import { PlaybackService } from './playback.service';
// Type-only: reuse the scheduler's toast shape so a voice-fired jingle shows the
// very same "in riproduzione" alert (no runtime coupling — the type is erased).
import type { PendingFire } from './scheduler.service';

/** Engine state (what the microphone/recognizer is doing right now). */
export type VoiceStatus = 'off' | 'loading' | 'listening' | 'denied' | 'error';

/** Microphone permission as remembered on THIS device. 'unknown' = not yet decided
 *  (may still prompt). Kept per-device (localStorage), never per-account. */
export type MicPermission = 'unknown' | 'granted' | 'denied';

/** The recognizer's messages carry either a final `text` or a live `partial`. */
type VoskResult = { result?: { text?: string; partial?: string } };

const VOICE_ENABLED_KEY = 'jingle-machine:voice-enabled';
/** Per-device memory of the mic permission answer (NOT per-account: the mic is
 *  hardware-local, and the account is shared across office PCs). */
const MIC_PERMISSION_KEY = 'jingle-machine:mic-permission';
/** Debounce after a jingle fires; also re-applied per jingle when its playback
 *  ENDS, so a long jingle's own tail can't re-trigger it once the mic reopens. */
const COOLDOWN_MS = 3000;
/** Keep the mic muted a bit AFTER any jingle ends (swallow the room tail/echo). */
const RESUME_AFTER_PLAY_MS = 800;
/** After a transient start failure, retry while still capo + enabled + mounted. */
const RETRY_MS = 5000;
/** Permissions API descriptor for the mic ('microphone' isn't in every lib's
 *  PermissionName union → cast so the build is version-independent). */
const MIC_QUERY = { name: 'microphone' } as unknown as PermissionDescriptor;

/**
 * Fires a jingle when its trigger phrase is spoken into the microphone.
 *
 * Runs ONLY when this device is the "capo" (LeaderService) AND voice mode is
 * enabled here (per-device toggle) AND the library view is active — so in an
 * office sharing one account, a single machine listens. Recognition is offline
 * (vosk-browser WASM, Italian model); the transcript is matched against each
 * jingle's `triggerPhrase`.
 *
 * Recognition is inhibited while ANY jingle is playing (PlaybackService) plus a
 * short tail, so the microphone never re-hears a jingle and triggers itself.
 */
@Injectable({ providedIn: 'root' })
export class VoiceTriggerService {
  private readonly leader = inject(LeaderService);
  private readonly playback = inject(PlaybackService);

  // Per-device preference (localStorage). Voice actually runs only if capo too.
  private readonly enabledSignal = signal(localStorage.getItem(VOICE_ENABLED_KEY) === '1');
  readonly enabled = this.enabledSignal.asReadonly();

  // Per-device memory of the mic permission (persisted). Reconciled with the real
  // OS/browser status on start (syncMicStatus) so a value fixed in System Settings
  // between sessions is picked up. Only 'denied' actually gates the engine.
  private readonly micSignal = signal<MicPermission>(readMicPermission());
  readonly mic = this.micSignal.asReadonly();

  /** Live engine state, for the UI indicator. */
  readonly status = signal<VoiceStatus>('off');
  /** Last transcript heard (a hint shown in the UI while listening). */
  readonly lastHeard = signal('');

  // --- Test mode (used by the create/edit modal to try a trigger phrase) ---
  /** True while a test session is listening (suspends the main engine). */
  readonly testing = signal(false);
  /** Words heard during the current test session (shown live in the modal). */
  readonly testTranscript = signal('');
  /** True once the test phrase has been recognized (the success check). */
  readonly testMatched = signal(false);

  /** Live "playing" toast for a voice-fired jingle (same shape/UI as the
   *  scheduler's). Null when no voice-triggered jingle is playing. Also drives
   *  the header microphone highlight (a jingle was just recognized). */
  readonly pending = signal<PendingFire | null>(null);

  private readonly viewActive = signal(false);
  private jinglesRef: Signal<Jingle[]> | null = null;

  private model: Model | null = null; // loaded once (~48 MB), reused across toggles
  private recognizer: KaldiRecognizer | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private starting = false;

  private readonly audio = new Audio(); // plays the voice-triggered jingle
  private readonly cooldowns = new Map<string, number>(); // jingleId -> muted-until timestamp
  private suppressUntil = 0; // global debounce: no fire (of any jingle) before this time
  private lastFiredId: string | null = null;
  private resumeAt = 0; // don't feed audio to the recognizer before this time
  private wasPlaying = false;
  private readonly retryToken = signal(0);
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // Test-mode audio graph (kept separate from the engine's; only one runs at a time).
  private testPhrase = '';
  private testStream: MediaStream | null = null;
  private testContext: AudioContext | null = null;
  private testSource: MediaStreamAudioSourceNode | null = null;
  private testProcessor: ScriptProcessorNode | null = null;
  private testRecognizer: KaldiRecognizer | null = null;

  constructor() {
    // The voice-triggered jingle counts as playback too (so it inhibits itself).
    this.audio.addEventListener('play', () => this.playback.begin(this));
    this.audio.addEventListener('timeupdate', () => this.onFiredProgress());
    this.audio.addEventListener('pause', () => {
      this.playback.end(this);
      this.pending.set(null); // hide the toast + mic highlight
    });
    this.audio.addEventListener('ended', () => {
      this.playback.end(this);
      this.pending.set(null);
      // Anti-echo: keep the jingle that just finished on cooldown past its own
      // trailing audio (COOLDOWN_MS from fire-time may elapse mid-playback).
      if (this.lastFiredId) this.cooldowns.set(this.lastFiredId, Date.now() + COOLDOWN_MS);
    });

    // Start/stop the whole engine reactively: capo + enabled + view mounted.
    // Suspended while a test session runs (see startTest) so a single microphone
    // and recognizer are ever active at a time. retryToken lets a transient
    // failure re-attempt without a run-condition change.
    effect(() => {
      const run = this.shouldRun();
      this.retryToken();
      if (run) void this.startEngine();
      else this.stopEngine();
    });

    // When any jingle stops, keep the mic muted for a short tail (anti-echo).
    effect(() => {
      const playing = this.playback.isPlaying();
      if (this.wasPlaying && !playing) this.resumeAt = Date.now() + RESUME_AFTER_PLAY_MS;
      this.wasPlaying = playing;
    });

    // Reconcile the remembered permission with the real OS/browser status and
    // watch for later changes (e.g. the user flips it in System Settings).
    void this.wireMicPermission();
  }

  /** Called by the library view: provides the live jingle list and marks it active. */
  start(jingles: Signal<Jingle[]>): void {
    this.jinglesRef = jingles;
    this.viewActive.set(true);
  }

  /** Called when the library view is left: releases the mic. */
  stop(): void {
    this.viewActive.set(false);
  }

  /** Per-device on/off (persisted). Voice still runs only when this device is capo. */
  setEnabled(on: boolean): void {
    this.enabledSignal.set(on);
    localStorage.setItem(VOICE_ENABLED_KEY, on ? '1' : '0');
  }

  toggle(): void {
    this.setEnabled(!this.enabled());
  }

  /**
   * User-driven re-request after a denial (the UI "Consenti microfono" action),
   * following each OS's rules. In Electron the bridge reports the real OS status:
   *  - already denied/restricted (macOS TCC or Windows privacy) → can't re-prompt;
   *    deep-link to System Settings, then resume via the focus/onchange watcher.
   *  - undecided → ask the OS (shows the prompt once), then start if granted.
   * On the web (no bridge) just clear the remembered denial and let the engine
   * re-attempt — getUserMedia surfaces Chromium's own prompt.
   */
  async requestPermission(): Promise<void> {
    const bridge = getBridge();
    if (bridge) {
      const status = await bridge.getMicStatus().catch(() => 'unknown');
      if (status === 'denied' || status === 'restricted') {
        await bridge.openMicSettings().catch(() => undefined);
        return; // recovery happens on return (focus / permission change)
      }
      if (status === 'not-determined') {
        const granted = await bridge.requestMic().catch(() => false);
        this.setMic(granted ? 'granted' : 'denied');
        if (granted) this.kickEngine();
        return;
      }
      // 'granted' / 'unknown' → fall through and let the engine attempt getUserMedia.
    }
    this.setMic('unknown');
    this.kickEngine();
  }

  /**
   * Starts a transient listening session that only transcribes (never fires a
   * jingle), so the user can check the microphone hears their trigger phrase.
   * Reuses the already-loaded vosk model; suspends the main engine while active.
   * Rejects if the microphone is unavailable so the caller can show an error.
   */
  async startTest(phrase: string): Promise<void> {
    if (this.testing()) return;
    this.testPhrase = normalize(phrase);
    this.testTranscript.set('');
    this.testMatched.set(false);
    this.testing.set(true); // the engine effect reads this and releases the mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      let model = this.model;
      if (!model) {
        const { createModel } = await import('vosk-browser');
        model = await createModel(environment.voice.modelUrl);
        this.model = model;
      }
      if (!this.testing()) {
        // Stopped (or modal closed) during the load.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.testStream = stream;
      this.testContext = new AudioContext();
      await this.testContext.resume();
      this.testRecognizer = new model.KaldiRecognizer(this.testContext.sampleRate);
      this.testRecognizer.setWords(false);
      this.testRecognizer.on('result', (m) => this.onTestText(readText(m)));
      this.testRecognizer.on('partialresult', (m) => this.onTestText(readText(m)));

      this.testSource = this.testContext.createMediaStreamSource(stream);
      this.testProcessor = this.testContext.createScriptProcessor(4096, 1, 1);
      this.testProcessor.onaudioprocess = (event) =>
        this.testRecognizer?.acceptWaveform(event.inputBuffer);
      this.testSource.connect(this.testProcessor);
      this.testProcessor.connect(this.testContext.destination);
    } catch (err) {
      console.error('Voice test failed to start:', err);
      this.stopTest();
      throw err;
    }
  }

  /** Stops the test session and lets the main engine resume (if applicable). */
  stopTest(): void {
    this.testProcessor?.disconnect();
    this.testSource?.disconnect();
    if (this.testRecognizer) {
      try {
        this.testRecognizer.remove();
      } catch {
        // recognizer already gone
      }
      this.testRecognizer = null;
    }
    this.testProcessor = null;
    this.testSource = null;
    if (this.testContext) {
      void this.testContext.close();
      this.testContext = null;
    }
    if (this.testStream) {
      this.testStream.getTracks().forEach((t) => t.stop());
      this.testStream = null;
    }
    this.testing.set(false); // last: lets the engine effect re-run and resume
  }

  /** Updates the phrase matched during a running test (input edited live). */
  setTestPhrase(phrase: string): void {
    this.testPhrase = normalize(phrase);
    this.testMatched.set(false); // target changed → re-evaluate on the next word
  }

  private onTestText(text: string): void {
    if (!text) return;
    this.testTranscript.set(text);
    if (!this.testPhrase) return;
    const heard = ` ${normalize(text)} `;
    if (heard.includes(` ${this.testPhrase} `)) this.testMatched.set(true);
  }

  private async startEngine(): Promise<void> {
    if (this.starting || this.stream) return; // already running or starting
    // Known-denied on this device: do NOT hammer getUserMedia (that endless retry
    // is exactly what looped the macOS prompt). Surface it; recovery is user-driven
    // (requestPermission) or automatic when the OS status flips back.
    if (this.mic() === 'denied') {
      this.status.set('denied');
      return;
    }
    this.starting = true;
    try {
      this.status.set('loading');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      this.setMic('granted'); // getUserMedia resolved → permission is granted here
      let model = this.model;
      if (!model) {
        const { createModel } = await import('vosk-browser');
        model = await createModel(environment.voice.modelUrl);
        this.model = model;
      }

      // The toggle may have flipped off (or leadership lost) during the load.
      if (!this.shouldRun()) {
        stream.getTracks().forEach((t) => t.stop());
        this.status.set('off');
        return;
      }

      this.stream = stream;
      this.audioContext = new AudioContext();
      // A context created without a user gesture (auto-start on becoming capo)
      // starts 'suspended' → onaudioprocess never fires. Resume it.
      await this.audioContext.resume();
      this.recognizer = new model.KaldiRecognizer(this.audioContext.sampleRate);
      this.recognizer.setWords(false);
      this.recognizer.on('result', (m) => this.onText(readText(m)));
      this.recognizer.on('partialresult', (m) => this.onText(readText(m)));

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      // ScriptProcessor is deprecated but self-contained (an AudioWorklet needs a
      // separate module file, awkward with the Angular bundler). Output stays
      // silent (we never write to it) -> connecting to destination is feedback-free.
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        if (this.canListen()) this.recognizer?.acceptWaveform(event.inputBuffer);
      };
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.status.set('listening');
    } catch (err) {
      this.teardownAudio();
      // An explicit denial: remember it per-device and STOP (re-calling getUserMedia
      // would just keep rejecting — and on macOS keep re-prompting). The UI offers a
      // user-driven re-request; recovery is otherwise automatic (see gotPermission).
      if ((err as { name?: string })?.name === 'NotAllowedError') {
        console.warn('Voice trigger: microphone permission denied.');
        this.setMic('denied');
        this.status.set('denied');
      } else {
        console.error('Voice trigger failed to start:', err);
        this.status.set('error');
        this.scheduleRetry(); // transient failure → retry while still applicable
      }
    } finally {
      this.starting = false;
    }
  }

  private stopEngine(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    // Stop any jingle this device triggered; don't let it play on after leaving.
    if (!this.audio.paused) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.cooldowns.clear();
    this.suppressUntil = 0;
    this.lastFiredId = null;
    if (this.stream || this.status() !== 'off') {
      this.teardownAudio();
      if (this.status() !== 'error') this.status.set('off');
    }
    this.lastHeard.set('');
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return; // one pending attempt is enough
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryToken.update((n) => n + 1); // re-runs the engine effect
    }, RETRY_MS);
  }

  /** Reconcile the remembered permission with reality and watch for changes. */
  private async wireMicPermission(): Promise<void> {
    await this.refreshMicStatus();
    // Live updates from the browser (fires when the user changes the setting).
    try {
      const perm = await navigator.permissions?.query(MIC_QUERY);
      if (perm) perm.onchange = () => this.applyPermState(perm.state);
    } catch {
      // 'microphone' not queryable here — the focus re-check below covers it.
    }
    // Returning to the app may follow a change in the OS settings (macOS can't
    // notify us): re-check the real status on focus.
    window.addEventListener('focus', () => void this.refreshMicStatus());
  }

  /** Read the current mic status (OS bridge = authoritative on macOS, else the
   *  browser Permissions API) and fold it into our per-device memory. */
  private async refreshMicStatus(): Promise<void> {
    const bridge = getBridge();
    if (bridge) {
      const status = await bridge.getMicStatus().catch(() => 'unknown');
      if (status !== 'unknown') return this.applyStatus(status);
    }
    try {
      const perm = await navigator.permissions?.query(MIC_QUERY);
      if (perm) this.applyPermState(perm.state);
    } catch {
      // Not supported → rely on the getUserMedia outcome to set the state.
    }
  }

  /** macOS TCC status → per-device memory. */
  private applyStatus(status: string): void {
    if (status === 'granted') this.gotPermission();
    else if (status === 'denied' || status === 'restricted') this.setMic('denied');
    else this.setMic('unknown'); // 'not-determined'
  }

  /** Browser Permissions API state → per-device memory. */
  private applyPermState(state: PermissionState): void {
    if (state === 'granted') this.gotPermission();
    else if (state === 'denied') this.setMic('denied');
    else this.setMic('unknown'); // 'prompt'
  }

  /** Permission is (now) granted: clear any denial and resume if we should run. */
  private gotPermission(): void {
    const wasBlocked = this.mic() !== 'granted';
    this.setMic('granted');
    if (this.status() === 'denied') this.status.set('off');
    if (wasBlocked) this.kickEngine();
  }

  /** Re-runs the engine effect (starts now if shouldRun()). */
  private kickEngine(): void {
    this.retryToken.update((n) => n + 1);
  }

  private setMic(value: MicPermission): void {
    this.micSignal.set(value);
    localStorage.setItem(MIC_PERMISSION_KEY, value);
  }

  /** True when this device is allowed to be listening right now. */
  private shouldRun(): boolean {
    return this.viewActive() && this.leader.isCapo() && this.enabled() && !this.testing();
  }

  private teardownAudio(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    if (this.recognizer) {
      try {
        this.recognizer.remove();
      } catch {
        // recognizer already gone
      }
      this.recognizer = null;
    }
    this.processor = null;
    this.source = null;
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  /** Only feed audio to the recognizer when listening and nothing is playing. */
  private canListen(): boolean {
    return this.status() === 'listening' && !this.playback.isPlaying() && Date.now() >= this.resumeAt;
  }

  private onText(text: string): void {
    if (!text) return;
    this.lastHeard.set(text);
    // Recognizer messages arrive async: re-check we may still fire (not torn down,
    // still capo/enabled/mounted) — canListen() only gates FEEDING, not firing.
    if (!this.shouldRun() || this.status() !== 'listening') return;
    const now = Date.now();
    if (now < this.suppressUntil) return; // global debounce (covers the pre-play gap)
    const heard = ` ${normalize(text)} `;
    for (const jingle of this.jinglesRef?.() ?? []) {
      const phrase = normalize(jingle.triggerPhrase ?? '');
      if (!phrase || !heard.includes(` ${phrase} `)) continue;
      if (now < (this.cooldowns.get(jingle.id) ?? 0)) continue; // still cooling down
      this.suppressUntil = now + COOLDOWN_MS;
      this.cooldowns.set(jingle.id, now + COOLDOWN_MS);
      this.lastFiredId = jingle.id;
      this.fire(jingle);
      break; // one jingle per utterance
    }
  }

  private fire(jingle: Jingle): void {
    this.audio.src = jingle.audioUrl;
    this.audio.volume = (jingle.volume ?? 100) / 100;
    this.audio.currentTime = 0;
    // Same toast the scheduler shows while a jingle plays.
    this.pending.set({
      occKey: `voice:${jingle.id}`,
      jingleName: jingle.name,
      phase: 'playing',
      secondsLeft: 0,
      progress: 100,
    });
    this.audio.play().catch((err) => {
      console.warn('Voice-triggered playback blocked:', err);
      this.pending.set(null);
    });
  }

  /** Toast button: stops the voice-fired jingle that is currently playing. */
  stopPlayback(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.pending.set(null);
  }

  private onFiredProgress(): void {
    const current = this.pending();
    if (!current) return;
    const { duration, currentTime } = this.audio;
    const remaining = duration ? duration - currentTime : 0;
    this.pending.set({
      ...current,
      secondsLeft: Math.ceil(remaining),
      progress: duration ? (remaining / duration) * 100 : 100,
    });
  }
}

/** Pulls the transcript out of a recognizer message (final text or live partial). */
function readText(message: unknown): string {
  const result = (message as VoskResult).result;
  return result?.text ?? result?.partial ?? '';
}

/** Lowercase, strip accents/punctuation, collapse spaces -> tolerant phrase matching. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Native OS mic status reported by the Electron bridge (macOS TCC values;
 *  'unknown' on platforms without an OS-level gate). */
type MicStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

/** Optional Electron preload bridge (see server/preload.cjs). Absent on the web
 *  build (dev / GitHub Pages) → the service falls back to pure web APIs. */
interface JingleMachineBridge {
  platform: string; // 'darwin' | 'win32' | ...
  getMicStatus(): Promise<MicStatus>;
  requestMic(): Promise<boolean>;
  openMicSettings(): Promise<void>;
}

function getBridge(): JingleMachineBridge | null {
  return (globalThis as { jingleMachine?: JingleMachineBridge }).jingleMachine ?? null;
}

/** Reads the per-device remembered permission; defaults to 'unknown'. */
function readMicPermission(): MicPermission {
  const value = localStorage.getItem(MIC_PERMISSION_KEY);
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}
