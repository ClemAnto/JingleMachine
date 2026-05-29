// Downloads the latest successful build artifacts (exe + dmg) from GitHub Actions.
// Files are saved in dist/{version}/ where version comes from the run's git tag,
// falling back to the version field in package.json.
// Usage: yarn download  (from the server/ folder)
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const REPO = "ClemAnto/JingleMachine";
const WORKFLOW = "build-packages.yml";
const ARTIFACT = "jingle-machine-packages";

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

// Determine version: prefer the git tag that triggered the run, fall back to package.json.
const headBranch = run(
  `${GH} run view ${runId} --repo ${REPO} --json headBranch -q ".headBranch"`
);
const localVersion = `v${JSON.parse(readFileSync("package.json", "utf8")).version}`;
const version = headBranch.startsWith("v") ? headBranch : localVersion;

const outDir = `dist/${version}`;
console.log(`Run: ${runId}  →  version: ${version}`);
console.log(`Downloading '${ARTIFACT}' → ${outDir}/`);

mkdirSync(outDir, { recursive: true });

execSync(
  `${GH} run download ${runId} --repo ${REPO} --name ${ARTIFACT} --dir ${outDir}`,
  { stdio: "inherit" }
);

console.log(`\nDone! Files saved in server/${outDir}/`);
