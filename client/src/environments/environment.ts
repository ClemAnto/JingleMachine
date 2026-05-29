/**
 * Project Firebase configuration.
 *
 * NOTE: these values are NOT secrets. The Firebase web config is meant to live
 * in the client; real security comes from the Firestore/Storage Security Rules
 * and the Authentication configuration.
 *
 * Replace the placeholders with your Firebase project's values
 * (Firebase Console → Project settings → Your apps → SDK setup and config).
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
