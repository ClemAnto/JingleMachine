import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

import { environment } from '../../environments/environment';

/**
 * DI tokens for the Firebase service instances.
 * Inject them in your services with `inject(AUTH)`, `inject(FIRESTORE)`, etc.
 * This way we use the Firebase JS SDK directly without depending on
 * @angular/fire (which does not officially support Angular 21 yet).
 */
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIREBASE_FIRESTORE');
export const STORAGE = new InjectionToken<FirebaseStorage>('FIREBASE_STORAGE');

export function provideFirebase(): EnvironmentProviders {
  const app = initializeApp(environment.firebase);
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useValue: app },
    { provide: AUTH, useValue: getAuth(app) },
    { provide: FIRESTORE, useValue: getFirestore(app) },
    { provide: STORAGE, useValue: getStorage(app) },
  ]);
}
