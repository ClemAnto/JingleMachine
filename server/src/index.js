// Jingle Machine helper: a tiny local server that turns a YouTube URL into an
// MP3, plus a metadata endpoint and a built-in mini test page.
import express from "express";
import cors from "cors";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { createInterface } from "node:readline";
import { config } from "./config.js";
import { ensureBinaries, updateYtDlp, binaryVersions } from "./binaries.js";
import { getInfo, extractMp3 } from "./youtube.js";

const app = express();

// Restrict cross-origin calls to the known web app origins. The mini test page
// is served from here (same origin), so it is unaffected.
app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json());

// Serve the Angular app if the dist has been bundled (pkg build) or copied here.
if (existsSync(config.angularDir)) {
  app.use(express.static(config.angularDir));
}

// Always serve the built-in mini test page (health check, manual extract).
app.use(express.static(config.publicDir));

// Keep the most recent log lines in memory so the mini page can show them.
const recentLogs = [];
function addLog(message) {
  const line = `${new Date().toISOString()}  ${message}`;
  recentLogs.push(line);
  if (recentLogs.length > 200) recentLogs.shift();
  console.log(line);
}

// Is the helper ready to extract? (all required binaries installed)
async function readiness() {
  const versions = await binaryVersions();
  const ready = Boolean(versions.ytDlp && versions.ffmpeg && versions.deno);
  return { ready, versions };
}

// Health: lets the web app show the "helper connected" indicator.
app.get("/health", async (req, res) => {
  const status = await readiness();
  res.json({ ok: true, ...status });
});

// Recent server logs, for the mini test page.
app.get("/logs", (req, res) => {
  res.json({ lines: recentLogs });
});

// Video metadata, without downloading the audio.
app.get("/info", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: "Missing 'url' query parameter" });
    return;
  }
  try {
    addLog(`info: ${url}`);
    res.json(await getInfo(url));
  } catch (error) {
    addLog(`info failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Extract (and optionally trim) the audio, returning the MP3.
app.post("/extract", async (req, res) => {
  const { url, start, end } = req.body ?? {};
  if (!url) {
    res.status(400).json({ error: "Missing 'url' in request body" });
    return;
  }
  let filePath;
  try {
    addLog(`extract: ${url} [${start ?? "?"} - ${end ?? "?"}]`);
    filePath = await extractMp3(url, start, end);
    res.download(filePath, "jingle.mp3", async () => {
      if (filePath) await unlink(filePath).catch(() => {});
    });
    addLog("extract: done");
  } catch (error) {
    addLog(`extract failed: ${error.message}`);
    if (filePath) await unlink(filePath).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

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
// In Fase 2, when the Angular app sends a heartbeat, we can skip this prompt
// automatically when a session is already active.
function askToOpenBrowser(url) {
  if (!process.stdin.isTTY) {
    // Non-interactive (e.g. piped or background): open automatically.
    openBrowser(url);
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`\nOpen the web app in your browser? [Y/n] `, (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== "n") openBrowser(url);
  });
}

app.listen(config.port, config.host, async () => {
  // Ensure mutable dirs exist on the real FS (important when running from pkg).
  await mkdir(config.binDir, { recursive: true });
  await mkdir(config.tmpDir, { recursive: true });

  const url = `http://${config.host}:${config.port}`;
  addLog(`Helper listening on ${url}`);

  if (config.isPkg) {
    askToOpenBrowser(url);
  } else {
    addLog("Open that address in the browser for the mini test page.");
  }

  // Prepare the binaries in the background so the page is reachable right away.
  try {
    await ensureBinaries(addLog);
    addLog("Updating yt-dlp...");
    await updateYtDlp();
    addLog("All binaries ready.");
  } catch (error) {
    addLog(`Binary setup failed: ${error.message}`);
  }
});
