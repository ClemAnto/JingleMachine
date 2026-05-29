// Downloads the latest successful build artifacts (exe + dmg) from GitHub Actions.
// Files are saved in dist/{version}/ where version is read from the version.txt
// file included in the artifact itself.
// Usage: yarn download  (from the server/ folder)
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, readdirSync } from "node:fs";

const REPO = "ClemAnto/JingleMachine";
const WORKFLOW = "build-packages.yml";
const ARTIFACT = "jingle-machine-packages";
const TMP_DIR = "dist/.tmp";

// On Windows, gh is often not in PATH — fall back to the known install location.
const GH =
  process.platform === "win32"
    ? '"C:\\Program Files\\GitHub CLI\\gh.exe"'
    : "gh";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }).trim();
}

// Find the latest successful run for the build workflow.
const runId = run(
  `${GH} run list --repo ${REPO} --workflow ${WORKFLOW} --status success --limit 1 --json databaseId -q ".[0].databaseId"`
);

if (!runId) {
  console.error("No successful runs found. Trigger the workflow first.");
  process.exit(1);
}

// Download to a temp folder first so we can read version.txt.
console.log(`Run: ${runId} — downloading to temp folder...`);
mkdirSync(TMP_DIR, { recursive: true });
execSync(
  `${GH} run download ${runId} --repo ${REPO} --name ${ARTIFACT} --dir ${TMP_DIR}`,
  { stdio: "inherit" }
);

// Read the version baked into the artifact at build time.
const version = `v${readFileSync(`${TMP_DIR}/version.txt`, "utf8").trim()}`;
const outDir = `dist/${version}`;
console.log(`\nVersion: ${version} → moving files to ${outDir}/`);

mkdirSync(outDir, { recursive: true });

// Move all files except version.txt to the versioned folder.
for (const file of readdirSync(TMP_DIR).filter((f) => f !== "version.txt")) {
  renameSync(`${TMP_DIR}/${file}`, `${outDir}/${file}`);
}
rmSync(TMP_DIR, { recursive: true });

console.log(`Done! Files saved in server/${outDir}/`);
