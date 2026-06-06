// Ensures the external programs the Mixer relies on (yt-dlp, ffmpeg, ffprobe,
// deno) are available, downloading them on first run into the bin folder.
//
// Why these four: yt-dlp does the actual YouTube work, but it needs ffmpeg and
// ffprobe to extract/convert audio, and (since late 2025) Deno as a JavaScript
// runtime to keep working with YouTube.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { mkdir, chmod, readdir, rename, rm, access } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { config } from "./config.js";

// require (not import) for this CJS dep: Electron's bundled Node (20.18) crashes
// importing CJS through ESM (cjsPreparseModuleExports). See note in server.js.
const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const run = promisify(execFile);
const isWindows = process.platform === "win32";
const exe = (name) => (isWindows ? `${name}.exe` : name);

// Paths where each binary lives once installed.
export const binaryPaths = {
  ytDlp: join(config.binDir, exe("yt-dlp")),
  ffmpeg: join(config.binDir, exe("ffmpeg")),
  ffprobe: join(config.binDir, exe("ffprobe")),
  deno: join(config.binDir, exe("deno")),
};

// --- small filesystem helpers -------------------------------------------------

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Streams a remote file to disk (fetch follows GitHub's redirect to the asset).
async function download(url, destPath) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destPath));
}

// Extracts a zip. We use a library instead of the system "tar" because that
// resolves to different tools depending on the machine (the native Windows tar
// handles zip, but a GNU tar from Git/MSYS does not).
function unzip(zipPath, destDir) {
  new AdmZip(zipPath).extractAllTo(destDir, true);
}

// Finds a file by name anywhere under a directory (archives nest binaries in
// subfolders, e.g. ffmpeg-*/bin/ffmpeg.exe).
async function findFile(dir, name) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

// --- per-binary installers ----------------------------------------------------

// yt-dlp ships as a single self-contained binary, so we just download it.
async function installYtDlp() {
  const base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
  const asset = isWindows ? "yt-dlp.exe" : "yt-dlp_macos";
  await download(`${base}/${asset}`, binaryPaths.ytDlp);
  if (!isWindows) await chmod(binaryPaths.ytDlp, 0o755);
}

// ffmpeg + ffprobe come bundled in one archive (BtbN on Windows, evermeet on
// macOS). We extract to a scratch folder, then move the two binaries we need.
async function installFfmpeg() {
  const scratch = join(config.binDir, "ffmpeg-download");
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });

  if (isWindows) {
    const url =
      "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip";
    const zip = join(scratch, "ffmpeg.zip");
    await download(url, zip);
    await unzip(zip, scratch);
  } else {
    // evermeet serves ffmpeg and ffprobe as separate zips.
    for (const tool of ["ffmpeg", "ffprobe"]) {
      const zip = join(scratch, `${tool}.zip`);
      await download(`https://evermeet.cx/ffmpeg/getrelease/${tool}/zip`, zip);
      await unzip(zip, scratch);
    }
  }

  for (const tool of ["ffmpeg", "ffprobe"]) {
    const found = await findFile(scratch, exe(tool));
    if (!found) throw new Error(`${tool} not found in the downloaded archive`);
    await rename(found, binaryPaths[tool]);
    if (!isWindows) await chmod(binaryPaths[tool], 0o755);
  }
  await rm(scratch, { recursive: true, force: true });
}

// Deno ships as a zip containing a single binary.
async function installDeno() {
  const scratch = join(config.binDir, "deno-download");
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });

  const asset = isWindows
    ? "deno-x86_64-pc-windows-msvc.zip"
    : process.arch === "arm64"
      ? "deno-aarch64-apple-darwin.zip"
      : "deno-x86_64-apple-darwin.zip";
  const zip = join(scratch, "deno.zip");
  await download(
    `https://github.com/denoland/deno/releases/latest/download/${asset}`,
    zip,
  );
  await unzip(zip, scratch);

  const found = await findFile(scratch, exe("deno"));
  if (!found) throw new Error("deno not found in the downloaded archive");
  await rename(found, binaryPaths.deno);
  if (!isWindows) await chmod(binaryPaths.deno, 0o755);
  await rm(scratch, { recursive: true, force: true });
}

// --- public API ---------------------------------------------------------------

const installers = [
  { name: "yt-dlp", path: binaryPaths.ytDlp, install: installYtDlp },
  { name: "ffmpeg", path: binaryPaths.ffmpeg, install: installFfmpeg },
  { name: "ffprobe", path: binaryPaths.ffprobe, install: installFfmpeg },
  { name: "deno", path: binaryPaths.deno, install: installDeno },
];

// Ensures every binary is present, downloading the missing ones. ffmpeg and
// ffprobe share an installer, so we guard against running it twice.
export async function ensureBinaries(log = console.log) {
  await mkdir(config.binDir, { recursive: true });
  await mkdir(config.tmpDir, { recursive: true });

  const alreadyInstalled = new Set();
  for (const binary of installers) {
    if (await fileExists(binary.path)) continue;
    if (alreadyInstalled.has(binary.install)) continue;
    log(`Downloading ${binary.name}...`);
    await binary.install();
    alreadyInstalled.add(binary.install);
    log(`${binary.name} ready.`);
  }
}

// Updates yt-dlp in place (YouTube changes often, so this keeps it working).
export async function updateYtDlp() {
  await run(binaryPaths.ytDlp, ["-U"]);
}

// Returns a short version string for each binary, or null if not installed yet.
export async function binaryVersions() {
  const versions = {};
  const probes = {
    ytDlp: [binaryPaths.ytDlp, ["--version"]],
    ffmpeg: [binaryPaths.ffmpeg, ["-version"]],
    deno: [binaryPaths.deno, ["--version"]],
  };
  for (const [name, [cmd, args]] of Object.entries(probes)) {
    try {
      const { stdout } = await run(cmd, args);
      versions[name] = stdout.split("\n")[0].trim();
    } catch {
      versions[name] = null;
    }
  }
  return versions;
}
