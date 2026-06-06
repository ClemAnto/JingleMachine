// Downloads the latest successful build artifacts (Windows .exe + macOS .dmg)
// from GitHub Actions into server/dist/v{version}/.
//
// Usage (from the server/ folder):
//   yarn download            → latest successful run of build-packages.yml
//   yarn download <runId>    → a specific run (e.g. an in-progress/older build)
//
// Requires the GitHub CLI (gh) authenticated for the repo.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const REPO = "ClemAnto/JingleMachine";
const WORKFLOW = "build-packages.yml";
// One artifact per matrix leg (see .github/workflows/build-packages.yml).
const ARTIFACTS = ["jingle-machine-win", "jingle-machine-mac"];

// On Windows, gh is often not in PATH — fall back to the known install location.
const GH =
  process.platform === "win32"
    ? '"C:\\Program Files\\GitHub CLI\\gh.exe"'
    : "gh";

function capture(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }).trim();
}

// Allow an explicit run id as the first CLI argument; otherwise pick the latest success.
let runId = process.argv[2];
if (!runId) {
  runId = capture(
    `${GH} run list --repo ${REPO} --workflow ${WORKFLOW} --status success --limit 1 --json databaseId -q ".[0].databaseId"`
  );
  if (!runId) {
    console.error("No successful runs found. Trigger the workflow first (gh workflow run build-packages.yml).");
    process.exit(1);
  }
}

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version;
const outDir = `dist/v${version}`;
mkdirSync(outDir, { recursive: true });
console.log(`Run ${runId} → downloading artifacts into server/${outDir}/`);

let downloaded = 0;
for (const name of ARTIFACTS) {
  try {
    // Each artifact extracts its single file (.exe or .dmg) straight into outDir.
    execSync(`${GH} run download ${runId} --repo ${REPO} --name ${name} --dir ${outDir}`, {
      stdio: "inherit",
    });
    downloaded++;
  } catch {
    console.warn(`! Artifact "${name}" not found in run ${runId} (that leg may have failed or been skipped).`);
  }
}

if (downloaded === 0) {
  console.error("No artifacts downloaded.");
  process.exit(1);
}
console.log(`\nDone! ${downloaded}/${ARTIFACTS.length} artifact(s) saved in server/${outDir}/`);
