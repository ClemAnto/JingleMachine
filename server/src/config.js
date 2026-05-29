// Central configuration for the helper. Paths are resolved relative to the
// project root (the "server" folder), so the helper works no matter where it
// is launched from.
//
// When running inside a pkg bundle (process.pkg is defined):
//   - snapshotRoot  → virtual FS inside the exe (bundled assets: public/, app/)
//   - runtimeRoot   → real FS next to the exe  (mutable: bin/, tmp/)
// In development both point to the server/ folder.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const snapshotRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const isPkg = typeof process.pkg !== "undefined";
const runtimeRoot = isPkg ? dirname(process.execPath) : snapshotRoot;

export const config = {
  isPkg,

  host: "127.0.0.1",
  port: Number(process.env.PORT) || 4321,

  // Mutable folders — must live on the real FS so the OS can execute binaries.
  binDir: join(runtimeRoot, "bin"),
  tmpDir: join(runtimeRoot, "tmp"),

  // Static asset folders — bundled inside the exe (or served from disk in dev).
  publicDir: join(snapshotRoot, "public"),
  angularDir: join(snapshotRoot, "app"), // Angular dist, copied here by CI

  // Browser origins allowed to call the helper. The mini interface is served
  // from the helper itself (same origin), so it needs no entry here.
  allowedOrigins: [
    "http://localhost:4200",          // Angular dev server
    "https://clemanto.github.io",     // GitHub Pages (production)
  ],

  // Default audio quality for extracted jingles. Kept low on purpose: jingles
  // are short and small files save Cloudinary bandwidth (project requirement).
  audioBitrate: "128K",
};
