import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Consente l'accesso alla rotta solo se l'utente è autenticato, altrimenti reindirizza al login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady;

  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Impedisce di vedere il login se già autenticati (manda all'editor). */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady;

  return auth.isLoggedIn() ? router.createUrlTree(['/']) : true;
};
