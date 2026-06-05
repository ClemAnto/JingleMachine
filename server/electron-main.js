// Electron entry point: starts the embedded Express server, then opens a window
// pointing at it. Closing the window quits the app, which ends the process and
// stops the server. The Angular app and all API endpoints are served over HTTP
// on localhost (same origin → no CORS, and Firebase's default authorized domain
// "localhost" matches, so Google sign-in works).
import { app, BrowserWindow, Menu } from "electron";

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
    const { startServer } = await import("./src/server.js");
    const { port } = await startServer();

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
