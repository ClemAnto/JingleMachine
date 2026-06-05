/**
 * Project configuration.
 *
 * Firebase values are NOT secrets — the web config is meant to live in the
 * client; security comes from Firestore Security Rules + Authentication.
 *
 * Cloudinary upload preset must be UNSIGNED (Settings → Upload presets).
 * The cloud name and preset are also not secret for unsigned uploads.
 *
 * Replace all TODO_* placeholders with real values.
 */
export const environment = {
  production: false,
  // Userless local test mode: bypass Firebase auth + Cloudinary (in-memory library,
  // object-URL audio). Enabled by the `mock` build configuration (environment.mock.ts).
  mock: false,
  firebase: {
    apiKey: 'TODO_API_KEY',
    authDomain: 'TODO_PROJECT.firebaseapp.com',
    projectId: 'TODO_PROJECT',
    messagingSenderId: 'TODO_SENDER_ID',
    appId: 'TODO_APP_ID',
  },
  cloudinary: {
    cloudName: 'TODO_CLOUD_NAME',
    uploadPreset: 'TODO_UPLOAD_PRESET',
  },
  // Local Mixer (runs on the user's machine, loopback). Same URL in dev and
  // prod: the Mixer always listens on 127.0.0.1 (browsers allow http://localhost
  // even from an https page).
  mixer: {
    baseUrl: 'http://127.0.0.1:4321',
  },
};
