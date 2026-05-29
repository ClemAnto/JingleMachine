/**
 * Configurazione Firebase del progetto.
 *
 * NOTA: questi valori NON sono segreti. La config web di Firebase è pensata per
 * stare nel client; la sicurezza reale è data dalle Security Rules di
 * Firestore/Storage e dalla configurazione di Authentication.
 *
 * Sostituisci i placeholder con i dati del tuo progetto Firebase
 * (Console Firebase → Impostazioni progetto → Le tue app → SDK setup and config).
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'TODO_API_KEY',
    authDomain: 'TODO_PROJECT.firebaseapp.com',
    projectId: 'TODO_PROJECT',
    storageBucket: 'TODO_PROJECT.appspot.com',
    messagingSenderId: 'TODO_SENDER_ID',
    appId: 'TODO_APP_ID',
  },
};
