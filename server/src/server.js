// The Jingle Machine Mixer server, as a reusable module: builds the Express
// app and starts listening. Two entry points use it:
//   - src/index.js     → headless (dev / GitHub Pages Mixer), with a console prompt
//   - electron-main.cjs → Electron app, which opens a window instead
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { ensureBinaries, updateYtDlp, binaryVersions } from "./binaries.js";
import { getInfo, extractMp3 } from "./youtube.js";

// Load CommonJS deps via require: Electron's bundled Node (20.18) crashes when
// importing these CJS modules through ESM (cjsPreparseModuleExports bug).
// createRequire uses the CJS loader, which is unaffected — and works in headless too.
const require = createRequire(import.meta.url);
const express = require("express");
const cors = require("cors");
// App version, exposed via /health so the client can offer updates.
const { version: appVersion } = require("../package.json");

// Keep the most recent log lines in memory so the mini page can show them.
const recentLogs = [];
export function addLog(message) {
  const line = `${new Date().toISOString()}  ${message}`;
  recentLogs.push(line);
  if (recentLogs.length > 200) recentLogs.shift();
  console.log(line);
}

// Defence in depth: only hand real YouTube URLs to yt-dlp.
function isYoutubeUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const { protocol, hostname } = new URL(value);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return hostname === "youtu.be" || hostname === "youtube.com" || hostname.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

// Is the Mixer ready to extract? (all required binaries installed)
async function readiness() {
  const versions = await binaryVersions();
  const ready = Boolean(versions.ytDlp && versions.ffmpeg && versions.deno);
  return { ready, versions };
}

// Builds the Express app with all routes (no listen).
export function createApp() {
  const app = express();

  // Restrict cross-origin calls to the known web app origins. The mini test
  // page and the Electron window are same-origin, so they are unaffected.
  app.use(cors({ origin: config.allowedOrigins }));
  app.use(express.json());

  // Mini test page always at /mixer (before Angular static so it is not shadowed).
  app.use("/mixer", express.static(config.publicDir));

  // Serve the Angular app at / if the dist has been bundled.
  if (existsSync(config.angularDir)) {
    app.use(express.static(config.angularDir));
  } else {
    app.use(express.static(config.publicDir));
  }

  // Health: lets the web app show the "Mixer connected" indicator.
  app.get("/health", async (req, res) => {
    const status = await readiness();
    res.json({ ok: true, version: appVersion, ...status });
  });

  // Recent server logs, for the mini test page.
  app.get("/logs", (req, res) => {
    res.json({ lines: recentLogs });
  });

  // Video metadata, without downloading the audio.
  app.get("/info", async (req, res) => {
    const url = req.query.url;
    if (!isYoutubeUrl(url)) {
      res.status(400).json({ error: "'url' must be a valid YouTube URL" });
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
    if (!isYoutubeUrl(url)) {
      res.status(400).json({ error: "'url' must be a valid YouTube URL" });
      return;
    }
    // start/end are optional (omitted = full audio), but when present they
    // must be a sane numeric range — never strings forwarded to yt-dlp.
    if (start != null || end != null) {
      const validRange =
        Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start;
      if (!validRange) {
        res.status(400).json({ error: "'start' and 'end' must be numbers with 0 <= start < end" });
        return;
      }
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

  // Graceful shutdown: responds first, then exits after a short delay.
  app.post("/shutdown", (req, res) => {
    res.json({ ok: true });
    addLog("Shutdown requested by the web app.");
    setTimeout(() => process.exit(0), 300);
  });

  // Heartbeat: the web app pings this periodically while it is open. The Mixer
  // stays alive until the FIRST heartbeat arrives (so standalone use of the
  // /mixer test page is never auto-killed), then shuts down if pings stop.
  let lastHeartbeat = null;
  app.post("/heartbeat", (req, res) => {
    lastHeartbeat = Date.now();
    res.json({ ok: true });
  });
  const idleCheck = setInterval(() => {
    if (lastHeartbeat && Date.now() - lastHeartbeat > config.heartbeatTimeoutMs) {
      addLog("No heartbeat from the web app; shutting down.");
      process.exit(0);
    }
  }, 30000);
  idleCheck.unref();

  // SPA fallback: must be registered AFTER all API routes so it only catches
  // truly unknown routes and returns Angular's index.html.
  if (existsSync(config.angularDir)) {
    app.get("*", (req, res) => {
      res.sendFile(join(config.angularDir, "index.html"));
    });
  }

  return app;
}

// Starts the Mixer: ensures mutable dirs, listens, and prepares binaries in the
// background. Returns { server, url, port }.
export async function startServer() {
  // Ensure mutable dirs exist on the real FS (important when running packaged).
  await mkdir(config.binDir, { recursive: true });
  await mkdir(config.tmpDir, { recursive: true });

  const app = createApp();
  const server = app.listen(config.port, config.host);
  const url = `http://${config.host}:${config.port}`;
  addLog(`Mixer listening on ${url}`);

  // Prepare the binaries in the background so the server is reachable right away.
  (async () => {
    try {
      await ensureBinaries(addLog);
      addLog("Updating yt-dlp...");
      await updateYtDlp();
      addLog("All binaries ready.");
    } catch (error) {
      addLog(`Binary setup failed: ${error.message}`);
    }
  })();

  return { server, url, port: config.port };
}
