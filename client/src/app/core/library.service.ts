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

/** Accent colours available for jingle cards (matches Figma swatch picker). */
export const JINGLE_COLORS = [
  '#ff4548', '#ff7a00', '#ffb700', '#52c41a',
  '#45fff3', '#1890ff', '#9000ff', '#ff45e5',
] as const;

export type JingleColor = typeof JINGLE_COLORS[number];

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
  durationSec: number;
  createdAt: Timestamp | null;
}

export interface JingleDraft {
  name: string;
  tags: string[];
  color: string;
  audioBlob: Blob;
  audioFilename: string;
  durationSec: number;
  imageFile?: File;
}

export interface JingleUpdate {
  name?: string;
  tags?: string[];
  color?: string;
  imageFile?: File;
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly cloudinary = inject(CloudinaryService);

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
        durationSec: draft.durationSec,
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
      durationSec: draft.durationSec,
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

  /** Deletes a jingle's Firestore document.
   *  Cloudinary assets are NOT deleted here (unsigned preset limitation). */
  async remove(jingle: Jingle): Promise<void> {
    if (environment.mock) {
      this.mockStore = this.mockStore.filter((j) => j.id !== jingle.id);
      return;
    }
    await deleteDoc(doc(this.db, this.COLLECTION, jingle.id));
  }
}
