import { Injectable, inject, signal } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { FIRESTORE } from './firebase.providers';

/**
 * A scheduled play of a jingle: at `time` (HH:mm, 24h, local), either once or
 * every day. The same jingle can be scheduled multiple times → one entry each.
 */
export interface ScheduledJingle {
  id: string;
  uid: string;          // owner uid (used by Firestore rules)
  jingleId: string;     // which jingle to play
  time: string;         // "HH:mm:ss" (24h, device local time)
  repeatDaily: boolean; // true = every day, false = one-shot
  enabled?: boolean;    // false = paused (kept in the list but never fires). Missing = active.
  createdAt: Timestamp | null;
}

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);

  private readonly COLLECTION = 'schedules';

  // Single source of truth, kept sorted by time. Firestore is just persistence
  // (non-mock); in mock mode this signal IS the whole store. Components read it
  // reactively, so add/update/remove update the UI without re-fetching.
  private readonly entries = signal<ScheduledJingle[]>([]);
  readonly schedules = this.entries.asReadonly();

  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('User not authenticated.');
    return user;
  }

  /** Loads the user's entries from Firestore into the signal (mock: no-op). */
  async load(): Promise<void> {
    if (environment.mock) return;
    const user = this.requireUser();
    const q = query(collection(this.db, this.COLLECTION), where('uid', '==', user.uid));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduledJingle, 'id'>) }));
    this.entries.set(sortByTime(list));
  }

  /** Adds a new scheduled entry. The per-user list is created implicitly on the
   *  first entry (a Firestore collection exists as soon as it has a document). */
  async add(jingleId: string, time: string, repeatDaily: boolean): Promise<void> {
    const user = this.requireUser();
    let id = `mock-${Math.random().toString(36).slice(2)}`;
    let createdAt: Timestamp | null = null;

    if (!environment.mock) {
      const ref = await addDoc(collection(this.db, this.COLLECTION), {
        uid: user.uid,
        jingleId,
        time,
        repeatDaily,
        enabled: true,
        createdAt: serverTimestamp(),
      });
      id = ref.id;
    }

    this.entries.update((list) =>
      sortByTime([...list, { id, uid: user.uid, jingleId, time, repeatDaily, enabled: true, createdAt }]),
    );
  }

  /** Pauses/resumes an entry without deleting it (disabled = never fires). */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    if (!environment.mock) {
      await updateDoc(doc(this.db, this.COLLECTION, id), { enabled });
    }
    this.entries.update((list) =>
      list.map((entry) => (entry.id === id ? { ...entry, enabled } : entry)),
    );
  }

  /** Updates only the time + repeat flag of an existing entry (not the jingle). */
  async update(id: string, time: string, repeatDaily: boolean): Promise<void> {
    if (!environment.mock) {
      await updateDoc(doc(this.db, this.COLLECTION, id), { time, repeatDaily });
    }
    this.entries.update((list) =>
      sortByTime(list.map((entry) => (entry.id === id ? { ...entry, time, repeatDaily } : entry))),
    );
  }

  /** Removes a scheduled entry. */
  async remove(id: string): Promise<void> {
    if (!environment.mock) {
      await deleteDoc(doc(this.db, this.COLLECTION, id));
    }
    this.entries.update((list) => list.filter((entry) => entry.id !== id));
  }

  /** Removes every entry pointing to a jingle (called when the jingle is deleted).
   *  Uses the in-memory signal to find them → no extra Firestore read. */
  async removeForJingle(jingleId: string): Promise<void> {
    const targets = this.entries().filter((entry) => entry.jingleId === jingleId);
    if (!environment.mock) {
      await Promise.all(targets.map((entry) => deleteDoc(doc(this.db, this.COLLECTION, entry.id))));
    }
    this.entries.update((list) => list.filter((entry) => entry.jingleId !== jingleId));
  }
}

/** Sorted by time of day (client-side → no Firestore composite index needed). */
function sortByTime(list: ScheduledJingle[]): ScheduledJingle[] {
  return [...list].sort((a, b) => a.time.localeCompare(b.time));
}
