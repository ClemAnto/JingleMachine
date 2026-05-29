import { Injectable, computed, inject, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

import { AUTH } from './firebase.providers';

/**
 * Authentication state exposed via signals.
 * `user` is `undefined` until Firebase has determined the initial state,
 * then `User | null`. Use `ready` to know when it has been resolved.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(AUTH);

  private readonly userSignal = signal<User | null | undefined>(undefined);

  readonly user = computed(() => this.userSignal() ?? null);
  readonly ready = computed(() => this.userSignal() !== undefined);
  readonly isLoggedIn = computed(() => !!this.userSignal());

  /** Resolves once Firebase has determined the initial authentication state. */
  readonly whenReady: Promise<void>;

  constructor() {
    let resolveReady!: () => void;
    this.whenReady = new Promise<void>((resolve) => (resolveReady = resolve));

    onAuthStateChanged(this.auth, (user) => {
      const first = this.userSignal() === undefined;
      this.userSignal.set(user);
      if (first) {
        resolveReady();
      }
    });
  }

  loginWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  registerWithEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  loginWithGoogle() {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  logout() {
    return signOut(this.auth);
  }
}
