import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Allows access only if authenticated AND the daily session has not expired;
 *  otherwise redirects to login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady;

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  // Firebase keeps the session forever; enforce a once-a-day login.
  if (auth.isSessionExpired()) {
    await auth.logout();
    return router.createUrlTree(['/login']);
  }
  return true;
};

/** Prevents seeing the login page when already authenticated (sends to the editor). */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.whenReady;

  return auth.isLoggedIn() ? router.createUrlTree(['/']) : true;
};
