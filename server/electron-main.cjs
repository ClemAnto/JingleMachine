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
const { app, BrowserWindow, Menu, session, systemPreferences, ipcMain, shell } = require("electron");

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

  async function start() {
    // The packaged app folder is read-only, so keep mutable data (downloaded
    // binaries, temp files) in a writable per-user folder. Must be set BEFORE
    // importing the server so config.js reads it.
    process.env.JM_DATA_DIR = app.getPath("userData");
    const serverUrl = pathToFileURL(path.join(__dirname, "src", "server.js")).href;
    const { startServer } = await import(serverUrl);
    const { port } = await startServer();

    // ---- Microphone permission (voice trigger) -----------------------------
    // Two independent layers gate the mic, and they must AGREE or the OS prompt
    // loops forever:
    //   1. Chromium (getUserMedia)  — controlled by the handlers below.
    //   2. macOS TCC (the real hardware gate) — owned by the OS, and only the
    //      MAIN process can resolve it (systemPreferences). Windows has no such
    //      layer, so there we just let Chromium handle it.
    // The old code granted only layer 1, leaving macOS "not-determined": every
    // access re-triggered the system prompt, and the renderer's retry made it
    // reappear endlessly.
    const isMac = process.platform === "darwin";

    // Bring macOS TCC to a decided state; resolves to whether the mic is usable.
    // "not-determined" → shows the OS prompt ONCE; "denied"/"restricted" resolve
    // immediately (macOS won't prompt again — the user must use System Settings).
    const ensureMacMic = async () => {
      if (!isMac) return true; // Windows: no TCC gate, Chromium is enough
      const status = systemPreferences.getMediaAccessStatus("microphone");
      if (status === "not-determined") return systemPreferences.askForMediaAccess("microphone");
      return status === "granted";
    };

    // Grant what this trusted localhost app asks for (also covers the Google
    // sign-in popup), but for the mic defer to the OS layer on macOS.
    session.defaultSession.setPermissionRequestHandler(async (_wc, permission, callback) => {
      if (permission === "media") return callback(await ensureMacMic());
      callback(true);
    });
    // Report the REAL mic status on macOS: if this lied "granted" while TCC is
    // unresolved, Chromium would skip the request handler and hit the OS prompt
    // on every access instead of asking exactly once.
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
      if (permission === "media" && isMac) {
        return systemPreferences.getMediaAccessStatus("microphone") === "granted";
      }
      return true;
    });

    // Renderer bridge (see preload.cjs) for OS-aware, per-device permission UX:
    // read the real status, (re)request access, and — since a denied mic can't be
    // re-prompted — deep-link to the OS microphone privacy settings.
    // getMediaAccessStatus is supported on macOS AND Windows (other platforms → 'unknown').
    const canReadStatus = isMac || process.platform === "win32";
    ipcMain.handle("mic:status", () =>
      canReadStatus ? systemPreferences.getMediaAccessStatus("microphone") : "unknown",
    );
    // askForMediaAccess is macOS-only; on Windows ensureMacMic returns true and the
    // renderer proceeds to getUserMedia (Chromium is auto-granted above).
    ipcMain.handle("mic:request", () => ensureMacMic());
    ipcMain.handle("mic:openSettings", () =>
      shell.openExternal(
        isMac
          ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
          : "ms-settings:privacy-microphone",
      ),
    );

    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      backgroundColor: "#00201c",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, "preload.cjs"),
      },
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
