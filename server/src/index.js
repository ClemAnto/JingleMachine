// Headless entry point: starts the Mixer and, when packaged, offers to open
// the web app in the system browser. Used in dev (`yarn start`) and as the
// standalone GitHub Pages Mixer. The Electron app uses electron-main.cjs instead.
import { exec } from "node:child_process";
import { createInterface } from "node:readline";
import { config } from "./config.js";
import { startServer, addLog } from "./server.js";

// When running as a packaged exe, keep the console open on crash so the user
// can read the error before the window closes.
if (config.isPkg) {
  const onFatalError = (err) => {
    console.error("\n--- CRASH ---");
    console.error(err);
    console.error("\nPress any key to close...");
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once("data", () => process.exit(1));
    }
  };
  process.on("uncaughtException", onFatalError);
  process.on("unhandledRejection", onFatalError);
}

// Opens the browser to the given URL (platform-aware).
function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? `start "" "${url}"` :
    process.platform === "darwin" ? `open "${url}"` :
    `xdg-open "${url}"`;
  exec(cmd, { shell: true }, (err) => {
    if (err) console.error("Could not open browser:", err.message);
  });
}

// Asks the user in the terminal if they want to open the browser.
function askToOpenBrowser(url) {
  if (!process.stdin.isTTY) {
    openBrowser(url); // Non-interactive (piped/background): open automatically.
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`\nOpen the web app in your browser? [Y/n] `, (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== "n") openBrowser(url);
  });
}

const { url } = await startServer();
const mixerUrl = `${url}/mixer`;
if (config.isPkg) {
  askToOpenBrowser(mixerUrl);
} else {
  addLog(`Open ${mixerUrl} in the browser for the mini test page.`);
}
