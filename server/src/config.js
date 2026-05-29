// Central configuration for the helper. Paths are resolved relative to the
// project root (the "server" folder), so the helper works no matter where it
// is launched from.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  // The helper listens only on localhost: it must never be reachable from the
  // network. The port is high to avoid clashing with the Angular dev server.
  host: "127.0.0.1",
  port: Number(process.env.PORT) || 4321,

  // Folders the helper owns.
  binDir: join(serverRoot, "bin"), // downloaded external binaries
  tmpDir: join(serverRoot, "tmp"), // temporary audio files
  publicDir: join(serverRoot, "public"), // the mini test interface

  // Browser origins allowed to call the helper. The mini interface is served
  // from the helper itself (same origin), so it needs no entry here.
  allowedOrigins: [
    "http://localhost:4200", // Angular dev server
    "https://clemanto.github.io", // GitHub Pages (production)
  ],

  // Default audio quality for extracted jingles. Kept low on purpose: jingles
  // are short and small files save Cloudinary bandwidth (project requirement).
  audioBitrate: "128K",
};
