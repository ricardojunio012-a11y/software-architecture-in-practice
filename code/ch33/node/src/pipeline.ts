// The Morada delivery pipeline. Each trunk commit goes through the stages in order;
// the first one that fails blocks the deployment. The stages run the real tools
// (tsc, vitest, dependency-cruiser) on the commit's code.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type Module, canary, traffic } from "./canary.ts";

const COMMITS = [
  { id: "c1", message: "3% discount for paying 5 days early" },
  { id: "c2", message: "discount truncated instead of rounded" },
  { id: "c3", message: "due date on a holiday moves to the business day (shortcut)" },
  { id: "c4", message: "due date on a holiday moves to the business day (port)" },
];

type Result = { ok: boolean; detail: string };
type Stage = { name: string; run(folder: string): Promise<Result> };

const bin = (tool: string) => `node_modules/.bin/${tool}`;
const run = (tool: string, args: string[]) =>
  spawnSync(bin(tool), args, { encoding: "utf8" });

function files(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(folder, name))
    .sort();
}

// --- the stages --------------------------------------------------------------------

async function compile(folder: string): Promise<Result> {
  const flags = ["--noEmit", "--strict", "--target", "es2023", "--module", "nodenext"];
  const extras = ["--allowImportingTsExtensions", "--types", "node", "--skipLibCheck"];
  const r = run("tsc", [...flags, ...extras, ...files(folder)]);
  const errors = (r.stdout.match(/error TS/g) ?? []).length;
  return { ok: r.status === 0, detail: r.status === 0 ? "" : `${errors} errors` };
}

async function test(folder: string): Promise<Result> {
  const report = `/tmp/vitest-${folder.replaceAll("/", "-")}.json`;
  const args = ["--config", "vitest.pipeline.ts", "--reporter=json"];
  run("vitest", ["run", folder, ...args, `--outputFile=${report}`]);
  const json = JSON.parse(readFileSync(report, "utf8"));
  const failures = json.testResults
    .flatMap((file: any) => file.assertionResults)
    .filter((t: any) => t.status === "failed")
    .map((t: any) => `"${t.title}"`);
  const count = `${json.numPassedTests} of ${json.numTotalTests}`;
  if (failures.length === 0) return { ok: true, detail: count };
  return { ok: false, detail: `${count}; failed: ${failures.join(", ")}` };
}

// The architecture test: the rules live in .dependency-cruiser.cjs
async function checkArchitecture(folder: string): Promise<Result> {
  const args = [folder, "--config", ".dependency-cruiser.cjs", "--output-type", "json"];
  const json = JSON.parse(run("depcruise", args).stdout);
  const violations = json.summary.violations.map(
    (v: any) =>
      `${v.rule.name}: ${relative(folder, v.from)} -> ${relative(folder, v.to)}`,
  );
  if (violations.length === 0) return { ok: true, detail: "0 violations" };
  return { ok: false, detail: violations.join("; ") };
}

// The artifact is identified by its content: the same code gives the same name, and
// it is this artifact, not a new build, that goes to the canary and to production
async function packageArtifact(folder: string): Promise<Result> {
  const hash = createHash("sha256");
  for (const file of files(folder).filter((f) => !f.endsWith(".test.ts"))) {
    hash.update(relative(folder, file)).update(readFileSync(file));
  }
  return { ok: true, detail: `morada-${hash.digest("hex").slice(0, 12)}` };
}

let production = "c0";
const requests = traffic(20_000, 2026);
const affected: string[] = [];

async function deployToCanary(folder: string): Promise<Result> {
  const next: Module = await import(`./commits/${folder.split("/").pop()}/index.ts`);
  const current: Module = await import(`./commits/${production}/index.ts`);
  const r = await canary(next, current, requests);
  const reason = r.canary.message ? ` (${r.canary.message})` : "";
  const detail =
    `5%: ${r.canary.errors} errors in ${r.canary.requests}${reason}; ` +
    `production: ${r.production.errors} in ${r.production.requests}`;
  if (!r.approved) affected.push(`${r.canary.errors}`);
  return { ok: r.approved, detail };
}

const STAGES: Stage[] = [
  { name: "compile", run: compile },
  { name: "tests", run: test },
  { name: "architecture", run: checkArchitecture },
  { name: "package", run: packageArtifact },
  { name: "canary", run: deployToCanary },
];

// --- the pipeline ------------------------------------------------------------------

const output = join(process.argv[2] ?? "/data", "output", "pipeline");
const lines: string[] = [`in production: c0`];
const deployments: string[] = [];
const failures: string[] = [];

for (const commit of COMMITS) {
  lines.push("", `commit ${commit.id}: ${commit.message}`);
  let blocked = "";
  for (const stage of STAGES) {
    const r = await stage.run(`src/commits/${commit.id}`);
    const status = r.ok ? "ok" : "FAILED";
    const line = `  ${stage.name.padEnd(13)}${status.padEnd(8)}${r.detail}`;
    // long details go on the next line, to fit on the page
    if (line.length <= 86) lines.push(line.trimEnd());
    else lines.push(`  ${stage.name.padEnd(13)}${status}`, `      ${r.detail}`);
    if (!r.ok) {
      blocked = stage.name;
      break;
    }
  }
  if (blocked === "canary") {
    deployments.push(commit.id);
    failures.push(commit.id);
    lines.push(
      `  => rolled back: the canary was turned off; production stays on ${production}`,
    );
  } else if (blocked) {
    lines.push(`  => blocked at the ${blocked} stage; nothing was deployed`);
  } else {
    deployments.push(commit.id);
    production = commit.id;
    lines.push(`  => deployed: ${commit.id} serves 100% of the traffic`);
  }
}

const rate = Math.round((100 * failures.length) / deployments.length);
lines.push(
  "",
  `summary: ${COMMITS.length} commits, ${deployments.length} deployments ` +
    `(${deployments.join(" and ")}), ${COMMITS.length - deployments.length} blocked`,
  `change failure rate: ${failures.length} of ${deployments.length} (${rate}%)`,
  `requests affected by the failure: ${affected.join(", ") || "none"} ` +
    `of ${requests.length}`,
  `in production: ${production}`,
);

mkdirSync(output, { recursive: true });
writeFileSync(join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
