import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { AuthService } from './auth.service';
import { FIRESTORE, STORAGE } from './firebase.providers';

export interface Jingle {
  id: string;
  uid: string;
  name: string;
  url: string;
  storagePath: string;
  size: number;
  durationSec: number;
  createdAt: Timestamp | null;
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly db = inject(FIRESTORE);
  private readonly storage = inject(STORAGE);
  private readonly auth = inject(AuthService);

  private readonly COLLECTION = 'jingles';

  private requireUid(): string {
    const uid = this.auth.user()?.uid;
    if (!uid) {
      throw new Error('Utente non autenticato.');
    }
    return uid;
  }

  /** Carica un MP3 su Storage e salva i metadati su Firestore. */
  async save(blob: Blob, name: string, durationSec: number): Promise<void> {
    const uid = this.requireUid();
    const safeName = name.replace(/[^\w.-]+/g, '_');
    const storagePath = `jingles/${uid}/${Date.now()}_${safeName}.mp3`;

    const storageRef = ref(this.storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: 'audio/mpeg' });
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(this.db, this.COLLECTION), {
      uid,
      name,
      url,
      storagePath,
      size: blob.size,
      durationSec,
      createdAt: serverTimestamp(),
    });
  }

  /** Elenca i jingle dell'utente corrente, dal più recente. */
  async list(): Promise<Jingle[]> {
    const uid = this.requireUid();
    const q = query(
      collection(this.db, this.COLLECTION),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Jingle, 'id'>) }));
  }

  /** Elimina un jingle (file su Storage + documento su Firestore). */
  async remove(item: Jingle): Promise<void> {
    await deleteObject(ref(this.storage, item.storagePath)).catch(() => undefined);
    await deleteDoc(doc(this.db, this.COLLECTION, item.id));
  }
}
