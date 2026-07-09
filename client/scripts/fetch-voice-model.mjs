// Downloads the Italian Vosk speech-recognition model and repackages it as the
// .tar.gz that vosk-browser expects, into client/public/models/. Run once for
// local dev, and in CI before `ng build` so the desktop app ships it. The output
// is gitignored (~48 MB) — it is fetched, never committed.
//
// Cross-platform via pure-JS libs (adm-zip, tar): no reliance on a system `tar`
// or `unzip` (Git Bash ships GNU tar, which cannot read .zip archives).
//
// Usage: node scripts/fetch-voice-model.mjs   (or: npm run voice:model)
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';
import { create as tarCreate } from 'tar';

const MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip';
const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '..', 'public', 'models');
const OUT_FILE = join(OUT_DIR, 'vosk-model-small-it.tar.gz');

if (existsSync(OUT_FILE)) {
  console.log(`Model already present, nothing to do: ${OUT_FILE}`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'vosk-model-'));
try {
  console.log('Downloading Italian model (~48 MB)...');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  console.log('Extracting...');
  new AdmZip(buffer).extractAllTo(work, true);

  // The zip extracts to a single "vosk-model-small-it-*" folder. vosk-browser
  // expects the archive's top-level directory to be named "model".
  const extracted = readdirSync(work, { withFileTypes: true }).find(
    (entry) => entry.isDirectory() && entry.name.startsWith('vosk-model'),
  );
  if (!extracted) throw new Error('Extracted model folder not found.');
  renameSync(join(work, extracted.name), join(work, 'model'));

  console.log('Packaging as tar.gz for vosk-browser...');
  mkdirSync(OUT_DIR, { recursive: true });
  await tarCreate({ gzip: true, file: OUT_FILE, cwd: work }, ['model']);

  console.log(`Done: ${OUT_FILE}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
