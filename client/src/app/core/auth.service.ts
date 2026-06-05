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
/** Daily login policy: a session older than this forces a fresh login. */
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LAST_LOGIN_KEY = 'jm.lastLoginAt';

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

  async loginWithEmail(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    this.markLogin();
    return cred;
  }

  async registerWithEmail(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    this.markLogin();
    return cred;
  }

  async loginWithGoogle() {
    const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
    this.markLogin();
    return cred;
  }

  async logout() {
    localStorage.removeItem(LAST_LOGIN_KEY);
    await signOut(this.auth);
  }

  /**
   * True when the session is older than the daily limit (or never stamped).
   * Firebase keeps users signed in indefinitely; this enforces a once-a-day login.
   */
  isSessionExpired(): boolean {
    const ts = Number(localStorage.getItem(LAST_LOGIN_KEY));
    return !ts || Date.now() - ts > SESSION_MAX_AGE_MS;
  }

  private markLogin() {
    localStorage.setItem(LAST_LOGIN_KEY, String(Date.now()));
  }
}
