import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

import { environment } from '../../environments/environment';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIREBASE_FIRESTORE');

export function provideFirebase(): EnvironmentProviders {
  const app = initializeApp(environment.firebase);
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useValue: app },
    { provide: AUTH, useValue: getAuth(app) },
    { provide: FIRESTORE, useValue: getFirestore(app) },
  ]);
}
