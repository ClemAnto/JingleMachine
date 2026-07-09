import { Injectable, inject } from '@angular/core';
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
import { CloudinaryService } from './cloudinary.service';
import { FIRESTORE } from './firebase.providers';
import { ScheduleService } from './schedule.service';

/** Accent colours available for jingle cards (from the Figma mockup SVG). */
export const JINGLE_COLORS = [
  '#D60F00', '#F97000', '#FFD500', '#56E42E',
  '#3AE9CF', '#007EF4', '#AA00FF', '#FF24A7',
] as const;

export type JingleColor = typeof JINGLE_COLORS[number];

/** Cover framing as object-position percentages (0–100). Absent = centered (50/50). */
export interface ImagePosition {
  x: number;
  y: number;
}

export interface Jingle {
  id: string;
  uid: string;                // uploader uid (used by Firestore rules)
  uploaderEmail: string;      // shown in the UI
  name: string;
  tags: string[];
  color: JingleColor | string;
  audioUrl: string;           // Cloudinary secure URL
  audioPublicId: string;      // for future server-side deletion
  imageUrl?: string;          // optional cover image (Cloudinary)
  imagePublicId?: string;
  imagePosition?: ImagePosition; // cover framing (object-position %); absent = centered
  durationSec: number;
  volume?: number;            // playback volume 0–100 (older docs lack it → treat as 100)
  triggerPhrase?: string;     // spoken word/phrase that fires this jingle (voice trigger); empty = none
  createdAt: Timestamp | null;
}

export interface JingleDraft {
  name: string;
  tags: string[];
  color: string;
  audioBlob: Blob;
  audioFilename: string;
  durationSec: number;
  volume: number;
  triggerPhrase: string;
  imageFile?: File;
  imagePosition?: ImagePosition;
}

export interface JingleUpdate {
  name?: string;
  tags?: string[];
  color?: string;
  volume?: number;
  triggerPhrase?: string;
  imageFile?: File;
  imagePosition?: ImagePosition;
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly schedule = inject(ScheduleService);

  private readonly COLLECTION = 'jingles';

  /** Userless mode only: in-memory library (lost on refresh). */
  private mockStore: Jingle[] = [];

  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('User not authenticated.');
    return user;
  }

  /** Uploads audio (+ optional image) to Cloudinary and saves metadata to Firestore. */
  async save(draft: JingleDraft): Promise<void> {
    const user = this.requireUser();

    if (environment.mock) {
      const [audio, image] = await Promise.all([
        this.cloudinary.uploadAudio(draft.audioBlob, draft.audioFilename),
        draft.imageFile ? this.cloudinary.uploadImage(draft.imageFile) : Promise.resolve(null),
      ]);
      this.mockStore.unshift({
        id: `mock-${Math.random().toString(36).slice(2)}`,
        uid: user.uid,
        uploaderEmail: user.email ?? '',
        name: draft.name,
        tags: draft.tags,
        color: draft.color,
        audioUrl: audio.secureUrl,
        audioPublicId: audio.publicId,
        imageUrl: image?.secureUrl,
        imagePublicId: image?.publicId,
        imagePosition: draft.imagePosition,
        durationSec: draft.durationSec,
        volume: draft.volume,
        triggerPhrase: draft.triggerPhrase || undefined,
        createdAt: null,
      });
      return;
    }

    const [audioResult, imageResult] = await Promise.all([
      this.cloudinary.uploadAudio(draft.audioBlob, draft.audioFilename),
      draft.imageFile ? this.cloudinary.uploadImage(draft.imageFile) : Promise.resolve(null),
    ]);

    await addDoc(collection(this.db, this.COLLECTION), {
      uid: user.uid,
      uploaderEmail: user.email ?? '',
      name: draft.name,
      tags: draft.tags,
      color: draft.color,
      audioUrl: audioResult.secureUrl,
      audioPublicId: audioResult.publicId,
      imageUrl: imageResult?.secureUrl ?? null,
      imagePublicId: imageResult?.publicId ?? null,
      imagePosition: draft.imagePosition ?? null,
      durationSec: draft.durationSec,
      volume: draft.volume,
      triggerPhrase: draft.triggerPhrase || null,
      createdAt: serverTimestamp(),
    });
  }

  /** Updates editable fields of an existing jingle. Replaces cover image if provided. */
  async update(jingle: Jingle, changes: JingleUpdate): Promise<void> {
    if (environment.mock) {
      const target = this.mockStore.find((j) => j.id === jingle.id);
      if (target) {
        if (changes.name !== undefined) target.name = changes.name;
        if (changes.tags !== undefined) target.tags = changes.tags;
        if (changes.color !== undefined) target.color = changes.color;
        if (changes.volume !== undefined) target.volume = changes.volume;
        if (changes.triggerPhrase !== undefined) target.triggerPhrase = changes.triggerPhrase || undefined;
        if (changes.imagePosition !== undefined) target.imagePosition = changes.imagePosition;
        if (changes.imageFile) {
          const image = await this.cloudinary.uploadImage(changes.imageFile);
          target.imageUrl = image.secureUrl;
          target.imagePublicId = image.publicId;
        }
      }
      return;
    }

    const imageResult = changes.imageFile
      ? await this.cloudinary.uploadImage(changes.imageFile)
      : null;

    const payload: Record<string, unknown> = {};
    if (changes.name !== undefined) payload['name'] = changes.name;
    if (changes.tags !== undefined) payload['tags'] = changes.tags;
    if (changes.color !== undefined) payload['color'] = changes.color;
    if (changes.volume !== undefined) payload['volume'] = changes.volume;
    if (changes.triggerPhrase !== undefined) payload['triggerPhrase'] = changes.triggerPhrase || null;
    if (changes.imagePosition !== undefined) payload['imagePosition'] = changes.imagePosition ?? null;
    if (imageResult) {
      payload['imageUrl'] = imageResult.secureUrl;
      payload['imagePublicId'] = imageResult.publicId;
    }

    await updateDoc(doc(this.db, this.COLLECTION, jingle.id), payload);
  }

  /** Lists the CURRENT user's jingles (private per-user library), most recent first. */
  async list(): Promise<Jingle[]> {
    const user = this.requireUser();
    if (environment.mock) return [...this.mockStore];
    const q = query(collection(this.db, this.COLLECTION), where('uid', '==', user.uid));
    const snap = await getDocs(q);
    const jingles = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Jingle, 'id'>) }));
    // Sort client-side (newest first) to avoid a Firestore composite index.
    return jingles.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  }

  /** Deletes a jingle's Firestore document + any schedules pointing to it.
   *  Cloudinary assets are NOT deleted here (unsigned preset limitation). */
  async remove(jingle: Jingle): Promise<void> {
    if (environment.mock) {
      this.mockStore = this.mockStore.filter((j) => j.id !== jingle.id);
      await this.schedule.removeForJingle(jingle.id);
      return;
    }
    await deleteDoc(doc(this.db, this.COLLECTION, jingle.id));
    await this.schedule.removeForJingle(jingle.id);
  }
}
