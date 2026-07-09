import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Timestamp,
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { FIRESTORE } from './firebase.providers';

const DEVICE_ID_KEY = 'jingle-machine:device-id';
const DEVICE_NAME_KEY = 'jingle-machine:device-name';

/** Presence heartbeat + freshness window: Firestore has no onDisconnect, so a
 *  client counts as "open" while its heartbeat is younger than the TTL. */
const HEARTBEAT_MS = 30_000;
const PRESENCE_TTL_MS = 90_000;

/**
 * Coordinates which open instance of the SAME user account is the "capo"
 * (leader). Only the capo runs the voice trigger, so two office PCs sharing one
 * account never fire the same spoken jingle twice.
 *
 * Leadership lives in a single Firestore doc `leaders/{uid}` =
 * { leaderId, leaderName, updatedAt }: writing it IS the claim, and the last
 * writer wins. Every instance watches the doc live via onSnapshot, so a change
 * propagates to all of them instantly (no polling, no heartbeat — one tiny doc).
 *
 * On connect a device auto-claims leadership ("the last to open is the capo");
 * any device can re-take it later with claim() (the "Diventa capo" button). If
 * the capo closes abruptly the doc stays put — someone just clicks the button on
 * the active PC (accepted trade-off: zero background traffic, fully predictable).
 */
@Injectable({ providedIn: 'root' })
export class LeaderService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);

  /** Stable per-device identity (generated once, kept in localStorage). */
  readonly deviceId = this.readOrCreate(DEVICE_ID_KEY, () => crypto.randomUUID());

  private readonly deviceNameSignal = signal(
    this.readOrCreate(DEVICE_NAME_KEY, () => `PC-${this.deviceId.slice(0, 4)}`),
  );
  /** Friendly name of THIS device (shown to other instances when it is the capo). */
  readonly deviceName = this.deviceNameSignal.asReadonly();

  private readonly leaderId = signal<string | null>(null);
  private readonly leaderNameSignal = signal('');
  private unsubscribe: Unsubscribe | null = null;

  private readonly clientCountSignal = signal(1);
  private presenceUnsub: Unsubscribe | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private onPageHide: (() => void) | null = null;

  /** True while THIS device holds the command. */
  readonly isCapo = computed(() => this.leaderId() === this.deviceId);
  /** Friendly name of the current capo (this device or another). */
  readonly capoName = this.leaderNameSignal.asReadonly();
  /** How many instances of this account are currently open (this one included). */
  readonly clientCount = this.clientCountSignal.asReadonly();

  /** Starts watching leadership and auto-claims it (last-in wins). */
  start(): void {
    this.stop(); // idempotent: clear any previous watchers/heartbeat before re-arming
    if (environment.mock) {
      this.leaderId.set(this.deviceId);
      this.leaderNameSignal.set(this.deviceName());
      return;
    }
    const user = this.auth.user();
    if (!user) return;
    const ref = doc(this.db, 'leaders', user.uid);
    this.unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data();
      this.leaderId.set((data?.['leaderId'] as string) ?? null);
      this.leaderNameSignal.set((data?.['leaderName'] as string) ?? '');
    });
    void this.claim(); // the last device to open becomes the capo
    this.startPresence(user.uid);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stopPresence();
  }

  /** Takes the command on this device (used on start and by the "Diventa capo" button). */
  async claim(): Promise<void> {
    if (environment.mock) {
      this.leaderId.set(this.deviceId);
      this.leaderNameSignal.set(this.deviceName());
      return;
    }
    const user = this.auth.user();
    if (!user) return;
    await setDoc(doc(this.db, 'leaders', user.uid), {
      leaderId: this.deviceId,
      leaderName: this.deviceName(),
      updatedAt: serverTimestamp(),
    });
  }

  /** Renames this device; if we are the capo, refresh the name other instances see. */
  setDeviceName(name: string): void {
    const clean = name.trim() || `PC-${this.deviceId.slice(0, 4)}`;
    this.deviceNameSignal.set(clean);
    localStorage.setItem(DEVICE_NAME_KEY, clean);
    if (this.isCapo()) void this.claim();
  }

  /** Tracks how many instances of this account are open, via a heartbeated
   *  presence doc per device (id "{uid}__{deviceId}"). */
  private startPresence(uid: string): void {
    const ref = doc(this.db, 'presence', `${uid}__${this.deviceId}`);
    const beat = () => void setDoc(ref, { uid, deviceId: this.deviceId, lastSeen: serverTimestamp() });
    beat();
    this.heartbeat = setInterval(beat, HEARTBEAT_MS);

    // Best-effort removal on close (unreliable in Firestore → the TTL below is
    // what actually keeps the count honest when a client vanishes).
    this.onPageHide = () => void deleteDoc(ref);
    window.addEventListener('pagehide', this.onPageHide);

    const mine = query(collection(this.db, 'presence'), where('uid', '==', uid));
    this.presenceUnsub = onSnapshot(mine, (snap) => {
      const now = Date.now();
      let live = 0;
      snap.forEach((entry) => {
        const seen = entry.get('lastSeen') as Timestamp | null;
        const ageMs = seen ? now - seen.toMillis() : 0; // a just-written doc has a pending timestamp
        // Count only fresh heartbeats. We deliberately do NOT delete stale peers'
        // docs: comparing our clock to their serverTimestamp is skew-prone (a fast
        // clock could reap healthy peers), and each device reuses its own doc id so
        // stale docs never accumulate — they simply stop counting.
        if (ageMs < PRESENCE_TTL_MS) live++;
      });
      this.clientCountSignal.set(Math.max(1, live));
    });
  }

  private stopPresence(): void {
    const wasRunning = this.presenceUnsub !== null;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.presenceUnsub?.();
    this.presenceUnsub = null;
    if (this.onPageHide) {
      window.removeEventListener('pagehide', this.onPageHide);
      this.onPageHide = null;
    }
    // Remove our own presence doc only if it was actually created (avoids a
    // spurious delete from the idempotent stop() at the top of start(), and in mock).
    if (wasRunning && !environment.mock) {
      const user = this.auth.user();
      if (user) void deleteDoc(doc(this.db, 'presence', `${user.uid}__${this.deviceId}`));
    }
    this.clientCountSignal.set(1);
  }

  private readOrCreate(key: string, make: () => string): string {
    let value = localStorage.getItem(key);
    if (!value) {
      value = make();
      localStorage.setItem(key, value);
    }
    return value;
  }
}
