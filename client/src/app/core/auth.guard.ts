import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Allows access to the route only if the user is authenticated, otherwise redirects to login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady;

  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Prevents seeing the login page when already authenticated (sends to the editor). */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady;

  return auth.isLoggedIn() ? router.createUrlTree(['/']) : true;
};
