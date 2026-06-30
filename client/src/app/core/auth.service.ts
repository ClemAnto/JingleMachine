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

import { environment } from '../../environments/environment';
import { AUTH } from './firebase.providers';

/**
 * Authentication state exposed via signals.
 * `user` is `undefined` until Firebase has determined the initial state,
 * then `User | null`. Use `ready` to know when it has been resolved.
 */
/** Weekly login policy: a session older than this forces a fresh login. */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_LOGIN_KEY = 'jm.lastLoginAt';

/**
 * Domain appended to a username to build a synthetic email for Firebase Auth.
 * Firebase only stores email + password; this address is never used to send
 * mail, so any non-routable domain works. It lets us offer a plain
 * username + password UI while keeping Firebase as the auth engine (stable uid).
 */
const USERNAME_DOMAIN = 'jinglemachine.local';

/** Maps a username to the synthetic email used internally (lowercased, trimmed). */
function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

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

    if (environment.mock) {
      // Userless mode: pretend a fixed user is always logged in (no Firebase).
      this.userSignal.set({
        uid: 'mock-user',
        email: 'mock@local.test',
        displayName: 'Mock User',
      } as User);
      resolveReady();
      return;
    }

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

  /** Username + password sign-in (the username maps to a synthetic email). */
  async loginWithUsername(username: string, password: string) {
    return this.loginWithEmail(usernameToEmail(username), password);
  }

  /** Username + password registration (self-service account creation). */
  async registerWithUsername(username: string, password: string) {
    return this.registerWithEmail(usernameToEmail(username), password);
  }

  async loginWithGoogle() {
    const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());
    this.markLogin();
    return cred;
  }

  async logout() {
    if (environment.mock) return; // no real session to end in userless mode
    localStorage.removeItem(LAST_LOGIN_KEY);
    await signOut(this.auth);
  }

  /**
   * True when the session is older than the weekly limit (or never stamped).
   * Firebase keeps users signed in indefinitely; this enforces a once-a-week login.
   */
  isSessionExpired(): boolean {
    if (environment.mock) return false; // never expire in userless mode
    const ts = Number(localStorage.getItem(LAST_LOGIN_KEY));
    return !ts || Date.now() - ts > SESSION_MAX_AGE_MS;
  }

  private markLogin() {
    localStorage.setItem(LAST_LOGIN_KEY, String(Date.now()));
  }
}
