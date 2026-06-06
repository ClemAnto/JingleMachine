import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';

import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { UiButton } from '../../ui/button/button';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    UiButton,
  ],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Legacy email + Google sign-in (kept in code, hidden unless the flag is on). */
  protected readonly emailMode = environment.emailAndGoogleAuth;

  protected readonly mode = signal<Mode>('login');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    // First field is an email in legacy mode, otherwise a plain username.
    identifier: [
      '',
      this.emailMode
        ? [Validators.required, Validators.email]
        : [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(20),
            // letters, digits, dot, underscore, hyphen (no spaces/symbols)
            Validators.pattern(/^[a-zA-Z0-9._-]+$/),
          ],
    ],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(64)]],
    // Only used (and validated) in register mode.
    confirmPassword: [''],
  });

  /** Switch between the sign-in and the account-creation views. */
  setMode(mode: Mode) {
    this.mode.set(mode);
    this.error.set(null);
    this.form.controls.confirmPassword.reset('');
  }

  /** Submit handler: routes to sign-in or registration based on the current mode. */
  async submit() {
    if (this.mode() === 'register') {
      await this.register();
      return;
    }
    await this.login();
  }

  private async login() {
    if (this.form.controls.identifier.invalid || this.form.controls.password.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { identifier, password } = this.form.getRawValue();
    await this.run(() =>
      this.emailMode
        ? this.auth.loginWithEmail(identifier, password)
        : this.auth.loginWithUsername(identifier, password),
    );
  }

  private async register() {
    if (this.form.controls.identifier.invalid || this.form.controls.password.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { identifier, password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.error.set('Le password non coincidono.');
      return;
    }
    await this.run(() =>
      this.emailMode
        ? this.auth.registerWithEmail(identifier, password)
        : this.auth.registerWithUsername(identifier, password),
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

  /** Maps the most common Firebase error codes to readable Italian messages. */
  private describe(err: unknown): string {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          return this.emailMode ? 'Email o password errati.' : 'Utente o password errati.';
        case 'auth/email-already-in-use':
          return this.emailMode ? 'Questa email è già registrata.' : 'Questo utente esiste già.';
        case 'auth/weak-password':
          return 'La password deve avere almeno 6 caratteri.';
        case 'auth/popup-closed-by-user':
          return 'Accesso con Google annullato.';
        case 'auth/operation-not-allowed':
          return 'Metodo di accesso non abilitato nella console Firebase.';
        default:
          return `Errore: ${err.code}`;
      }
    }
    return 'Si è verificato un errore imprevisto.';
  }
}
