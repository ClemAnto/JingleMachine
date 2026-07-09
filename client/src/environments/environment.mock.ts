/**
 * MOCK environment — userless local testing.
 * Used by the `mock` build configuration (`ng serve --configuration mock`).
 * Bypasses Firebase auth and Cloudinary: fake user, in-memory library, audio
 * served via object URLs. The YouTube extraction (Mixer) stays REAL.
 * Note: the library is in-memory only → it does NOT survive a page refresh.
 */
export const environment = {
  production: false,
  version: '0.12.1',
  mock: true,
  emailAndGoogleAuth: false,
  firebase: {
    apiKey: 'mock',
    authDomain: 'mock',
    projectId: 'mock',
    messagingSenderId: 'mock',
    appId: 'mock',
  },
  cloudinary: {
    cloudName: 'mock',
    uploadPreset: 'mock',
  },
  mixer: {
    baseUrl: 'http://127.0.0.1:4321',
  },
  voice: {
    modelUrl: '/models/vosk-model-small-it.tar.gz',
  },
};
