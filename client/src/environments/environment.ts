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
  // App version shown in the UI. Keep in sync with server/package.json on release.
  version: '0.12.1',
  // Userless local test mode: bypass Firebase auth + Cloudinary (in-memory library,
  // object-URL audio). Enabled by the `mock` build configuration (environment.mock.ts).
  mock: false,
  // Login UI: when false (default) only the simple username + password form is shown.
  // The email + Google sign-in code stays in place; set to true to bring it back.
  emailAndGoogleAuth: false,
  firebase: {
    apiKey: 'AIzaSyAgx11WcT5CfqJXoJdjO5ZnEcbp5gJeBlE',
    authDomain: 'jingle-machine-2026.firebaseapp.com',
    projectId: 'jingle-machine-2026',
    messagingSenderId: '652328824925',
    appId: '1:652328824925:web:559baff22f2db8dfb65db4',
  },
  cloudinary: {
    cloudName: 'dnpbzwccm',
    uploadPreset: 'unsigned',
  },
  // Local Mixer (runs on the user's machine, loopback). Same URL in dev and
  // prod: the Mixer always listens on 127.0.0.1 (browsers allow http://localhost
  // even from an https page).
  mixer: {
    baseUrl: 'http://127.0.0.1:4321',
  },
  // Offline speech-recognition model (vosk-browser) for the voice trigger.
  // Bundled as a static asset (see client/scripts/fetch-voice-model.mjs): served
  // at the app root in dev (public/) and by the embedded server in the desktop app.
  voice: {
    modelUrl: '/models/vosk-model-small-it.tar.gz',
  },
};
