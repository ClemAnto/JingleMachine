import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

import { environment } from '../../environments/environment';

/**
 * Token DI per le istanze dei servizi Firebase.
 * Iniettali nei tuoi service con `inject(AUTH)`, `inject(FIRESTORE)`, ecc.
 * In questo modo usiamo l'SDK Firebase JS direttamente senza dipendere da
 * @angular/fire (che non supporta ancora ufficialmente Angular 21).
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
