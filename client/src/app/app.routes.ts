import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./views/login/login').then((m) => m.Login),
  },
  {
    path: 'stylesheet',
    loadComponent: () => import('./views/stylesheet/stylesheet').then((m) => m.Stylesheet),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./views/library/library').then((m) => m.Library),
  },
  { path: '**', redirectTo: '' },
];
