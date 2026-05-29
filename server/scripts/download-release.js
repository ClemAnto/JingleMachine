// Downloads the latest successful build artifacts (exe + dmg) from GitHub Actions.
// Runs via: yarn download  (from the server/ folder)
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const REPO = "ClemAnto/JingleMachine";
const WORKFLOW = "build-packages.yml";
const ARTIFACT = "jingle-machine-packages";
const OUT_DIR = "dist";

// On Windows, gh is often not in PATH — fall back to the known install location.
const GH =
  process.platform === "win32"
    ? '"C:\\Program Files\\GitHub CLI\\gh.exe"'
    : "gh";

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], ...opts }).trim();
}

// Find the latest successful run for the build workflow.
const runId = run(
  `${GH} run list --repo ${REPO} --workflow ${WORKFLOW} --status success --limit 1 --json databaseId -q ".[0].databaseId"`
);

if (!runId) {
  console.error("No successful runs found. Trigger the workflow first.");
  process.exit(1);
}

console.log(`Latest successful run: ${runId}`);
console.log(`Downloading '${ARTIFACT}' → ${OUT_DIR}/`);

mkdirSync(OUT_DIR, { recursive: true });

execSync(
  `${GH} run download ${runId} --repo ${REPO} --name ${ARTIFACT} --dir ${OUT_DIR}`,
  { stdio: "inherit" }
);

console.log(`\nDone! Files saved in server/${OUT_DIR}/`);
