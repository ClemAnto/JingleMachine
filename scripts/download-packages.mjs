// Downloads the latest COMPLETE app packages (Windows .exe + macOS .dmg) built
// by GitHub Actions into dist/v{version}/ at the repo root.
//
// These installers bundle BOTH the client (Angular UI) and the server (Mixer),
// so fetching them is a project-level task — hence this lives in the root
// package, not in server/. The app version is read from server/package.json
// (the single source of truth used by electron-builder).
//
// Usage (from the repo root):
//   npm run download            → latest successful run of build-packages.yml
//   npm run download -- <runId> → a specific run id
//
// Requires the GitHub CLI (gh) authenticated for the repo.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

// Paths resolved relative to this script, so it works from any cwd.
const version = JSON.parse(readFileSync(new URL("../server/package.json", import.meta.url))).version;
// No trailing slash: on Windows a path ending in "\" would escape the closing
// quote when passed as --dir "...\" and corrupt the argument.
const outDir = fileURLToPath(new URL(`../dist/v${version}`, import.meta.url));
// Start clean: gh run download refuses to overwrite existing files, so a re-run
// would fail with "The file exists" unless we clear the version folder first.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
console.log(`Run ${runId} → downloading the complete app packages into dist/v${version}/`);

let downloaded = 0;
for (const name of ARTIFACTS) {
  try {
    // Each artifact extracts its single file (.exe or .dmg) straight into outDir.
    execSync(`${GH} run download ${runId} --repo ${REPO} --name ${name} --dir "${outDir}"`, {
      stdio: "inherit",
    });
    downloaded++;
  } catch (err) {
    console.warn(`! Could not download "${name}" from run ${runId}: ${err.message}`);
  }
}

if (downloaded === 0) {
  console.error("No artifacts downloaded.");
  process.exit(1);
}
console.log(`\nDone! ${downloaded}/${ARTIFACTS.length} package(s) saved in dist/v${version}/`);
