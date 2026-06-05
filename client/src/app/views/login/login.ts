import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';

import { AuthService } from '../../core/auth.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
  ],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('login');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  toggleMode() {
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
    this.error.set(null);
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    await this.run(() =>
      this.mode() === 'login'
        ? this.auth.loginWithEmail(email, password)
        : this.auth.registerWithEmail(email, password),
    );
  }

  async google() {
    await this.run(() => this.auth.loginWithGoogle());
  }

  private async run(action: () => Promise<unknown>) {
    this.loading.set(true);
    this.error.set(null);
    try {
      await action();
      this.router.navigate(['/']);
    } catch (err) {
      this.error.set(this.describe(err));
    } finally {
      this.loading.set(false);
    }
  }

  /** Maps the most common Firebase error codes to readable messages. */
  private describe(err: unknown): string {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          return 'Wrong email or password.';
        case 'auth/email-already-in-use':
          return 'This email is already registered.';
        case 'auth/weak-password':
          return 'Password must be at least 6 characters.';
        case 'auth/popup-closed-by-user':
          return 'Google sign-in cancelled.';
        case 'auth/operation-not-allowed':
          return 'Sign-in method not enabled in Firebase console.';
        default:
          return `Error: ${err.code}`;
      }
    }
    return 'An unexpected error occurred.';
  }
}
