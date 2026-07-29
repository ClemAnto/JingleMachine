// Electron entry point (CommonJS). Starts the embedded Express server, then opens
// a window pointing at it. Closing the window quits the app, which ends the
// process and stops the server. The Angular app and all API endpoints are served
// over HTTP on localhost (same origin → no CORS, and Firebase's default authorized
// domain "localhost" matches, so Google sign-in works).
//
// Why CommonJS (.cjs) and not ESM: Electron's bundled Node (20.18) crashes when an
// ESM module imports a CommonJS one (cjsPreparseModuleExports bug) — and Electron's
// own "electron" module is CommonJS. A CJS entry require()s electron normally, then
// dynamically import()s the ESM server module (import() works fine from CJS).
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, session, systemPreferences } = require("electron");

// userData → %APPDATA%\JingleMachine (win) / ~/Library/Application Support/JingleMachine (mac).
app.setName("JingleMachine");

// One instance only: a second launch focuses the existing window instead of
// starting a second server on the same port.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow = null;

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // macOS gates the microphone itself (TCC), on top of Chromium's permission.
  // The system prompt only appears if the app explicitly asks for access, and
  // Electron rejects getUserMedia outright once the status is denied/restricted
  // — so ask on the first request and report the OS's real answer. Elsewhere
  // (Windows/Linux) there is no such gate: the request is simply granted.
  async function hasMicrophoneAccess() {
    if (process.platform !== "darwin") return true;
    const status = systemPreferences.getMediaAccessStatus("microphone");
    if (status === "granted") return true;
    if (status === "not-determined") return systemPreferences.askForMediaAccess("microphone");
    // 'denied' / 'restricted': only the user can lift it, in System Settings →
    // Privacy & Security → Microphone (the app must be relaunched afterwards).
    console.warn(`Microphone access ${status}: enable Jingle Machine in System Settings.`);
    return false;
  }

  async function start() {
    // The packaged app folder is read-only, so keep mutable data (downloaded
    // binaries, temp files) in a writable per-user folder. Must be set BEFORE
    // importing the server so config.js reads it.
    process.env.JM_DATA_DIR = app.getPath("userData");
    const serverUrl = pathToFileURL(path.join(__dirname, "src", "server.js")).href;
    const { startServer } = await import(serverUrl);
    const { port } = await startServer();

    // Allow the renderer to use the microphone (voice trigger). This is our own
    // trusted localhost app; granting requests here matches Electron's prior
    // default (no handler) while guaranteeing 'media'. The OS still gates the
    // actual hardware. We must NOT deny the rest: this shared session also governs
    // the Google sign-in popup and any future permission the app needs.
    session.defaultSession.setPermissionRequestHandler(async (_wc, permission, callback) => {
      callback(permission === "media" ? await hasMicrophoneAccess() : true);
    });
    session.defaultSession.setPermissionCheckHandler(() => true);

    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      backgroundColor: "#00201c",
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    // Use localhost (not 127.0.0.1) so Firebase's default authorized domain matches.
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(start);

  // Quitting ends the process, which stops the embedded server too.
  app.on("window-all-closed", () => app.quit());
}
