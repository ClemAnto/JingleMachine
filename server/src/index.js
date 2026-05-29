// Jingle Machine helper: a tiny local server that turns a YouTube URL into an
// MP3, plus a metadata endpoint and a built-in mini test page.
import express from "express";
import cors from "cors";
import { unlink } from "node:fs/promises";
import { config } from "./config.js";
import { ensureBinaries, updateYtDlp, binaryVersions } from "./binaries.js";
import { getInfo, extractMp3 } from "./youtube.js";

const app = express();

// Restrict cross-origin calls to the known web app origins. The mini test page
// is served from here (same origin), so it is unaffected.
app.use(cors({ origin: config.allowedOrigins }));
app.use(express.json());
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
      // Clean up the temporary file once the response has been sent.
      if (filePath) await unlink(filePath).catch(() => {});
    });
    addLog("extract: done");
  } catch (error) {
    addLog(`extract failed: ${error.message}`);
    if (filePath) await unlink(filePath).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

app.listen(config.port, config.host, async () => {
  addLog(`Helper listening on http://${config.host}:${config.port}`);
  addLog("Open that address in the browser for the mini test page.");
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
