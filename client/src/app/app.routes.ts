import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'stylesheet',
    loadComponent: () => import('./features/stylesheet/stylesheet').then((m) => m.Stylesheet),
  },
  {
    path: '',
    //canActivate: [authGuard],
    loadComponent: () => import('./features/library/library').then((m) => m.Library),
  },
  { path: '**', redirectTo: '' },
];
