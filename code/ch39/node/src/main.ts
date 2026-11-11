// Usage: node src/main.ts history|hotspots|coupling|business-case <output folder>
//        node src/main.ts analyze <repository>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interest, options, type Assumptions } from "./business-case.ts";
import { currentFiles, readLog, type Change } from "./git.ts";
import { createRepository } from "./history.ts";
import { changeCoupling, dropLarge, hotspots, imports, MAX_FILES } from "./metrics.ts";

const num = (x: number, decimals = 0) =>
  x.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const dollars = (x: number) => `$${num(Math.round(x / 100) * 100)}`;
const pct = (x: number) => `${num(100 * x)}%`;
const short = (path: string) => path.replace(/^src\//, "");

function hotspotReport(all: Change[], current: Map<string, string>) {
  const changes = dropLarge(all);
  const header = [
    " #",
    "file".padEnd(26),
    "revisions",
    "lines".padStart(6),
    "complexity".padStart(12),
    "priority".padStart(10),
    "main author",
  ];
  const l = [
    `${all.length} commits; ${all.length - changes.length} ignored ` +
      `for touching more than ${MAX_FILES} files`,
    "",
    header.join(" "),
  ];
  hotspots(changes, current).forEach((h, i) => {
    const author = `${h.mainAuthor.split(" ")[0]} ${pct(h.authorShare)}`;
    l.push(
      `${String(i + 1).padStart(2)} ${short(h.file).padEnd(26)} ` +
        `${String(h.revisions).padStart(9)} ${num(h.lines).padStart(6)} ` +
        `${num(h.complexity).padStart(12)} ` +
        `${String(h.priority).padStart(10)} ${author}`,
    );
  });
  return l;
}

function couplingReport(all: Change[], current: Map<string, string>) {
  const header = [
    "file A".padEnd(26),
    "file B".padEnd(26),
    "together".padStart(8),
    "degree".padStart(6),
  ];
  const l = [
    "Pairs that changed together in at least 5 commits and 30% of the time",
    "",
    `${header.join(" ")}  ${"modules".padEnd(8)}  import?`,
  ];
  for (const p of changeCoupling(dropLarge(all))) {
    const moduleOf = (path: string) => path.split("/")[1];
    const same = moduleOf(p.a) === moduleOf(p.b) ? "same" : "other";
    const visible =
      imports(current.get(p.a) ?? "", p.b) || imports(current.get(p.b) ?? "", p.a);
    l.push(
      `${short(p.a).padEnd(26)} ${short(p.b).padEnd(26)} ` +
        `${String(p.together).padStart(8)} ` +
        `${pct(p.degree).padStart(6)}  ${same.padEnd(8)}  ${visible ? "yes" : "NO"}`,
    );
  }
  return l;
}

function businessCaseReport(all: Change[], current: Map<string, string>) {
  const assumptions: Assumptions = JSON.parse(readFileSync("assumptions.json", "utf8"));
  const target = hotspots(dropLarge(all), current)[0].file;
  const recent = dropLarge(all).filter(
    (c) => c.date >= "2026-01-01" && c.date <= "2026-06-30",
  );
  const i = interest(recent, target, 2, assumptions.hourlyRate);
  const earlier = dropLarge(all).filter((c) => c.date <= "2025-06-30");
  const i2025 = interest(earlier, target, 2, assumptions.hourlyRate);
  const opts = options(i, assumptions);
  const col = (label: string, value: string) =>
    `  ${label.padEnd(46)}${value.padStart(14)}`;
  const columns = ["paydown", "int./year", "delay", "12 months", "24 months"];
  const l = [
    `Hotspot: ${target}`,
    `Period: ${recent.length} commits from 2026-01-01 to 2026-06-30 (two quarters)`,
    "",
    "Interest",
    col("changes that touched the file", num(i.changesToFile)),
    col("hours per change to the file", `${num(i.hoursInFile, 1)} h`),
    col(
      "  a year earlier (2025-01-01 to 2025-06-30)",
      `${num(i2025.hoursInFile, 1)} h`,
    ),
    col("hours per change to the rest of the code", `${num(i.hoursElsewhere, 1)} h`),
    col("fixes among the changes to the file", pct(i.fixesInFile)),
    col("fixes among the changes to the rest", pct(i.fixesElsewhere)),
    col("extra hours per quarter", `${num(i.extraHoursPerQuarter)} h`),
    col(
      `interest per quarter ($${assumptions.hourlyRate} per hour)`,
      dollars(i.interestPerQuarter),
    ),
    "",
    `Options (feature: ${assumptions.feature.name})`,
    " ".repeat(14) + "weeks".padStart(8) + columns.map((c) => c.padStart(11)).join(""),
  ];
  const d = (x: number) => dollars(x).padStart(10);
  for (const o of opts) {
    l.push(
      `  ${o.name.padEnd(12)}${num(o.weeksToFeature, 1).padStart(8)} ` +
        `${d(o.paydownCost)} ${d(o.interestPerYear)} ${d(o.featureDelay)} ` +
        `${d(o.total12)} ${d(o.total24)}`,
    );
  }
  return l;
}

function historyReport(folder: string, all: Change[], current: Map<string, string>) {
  const authors = new Set(all.map((c) => c.author));
  const latest = execFileSync("git", ["log", "-4", "--format=%as  %<(15)%an %s"], {
    cwd: folder,
    encoding: "utf8",
  });
  return [
    `Repository: ${folder}`,
    `commits: ${all.length}, from ${all[0].date} to ${all[all.length - 1].date}`,
    `authors: ${authors.size}; files: ${current.size}`,
    "",
    "The four most recent commits:",
    ...latest.trimEnd().split("\n"),
  ];
}

const [version, target] = process.argv.slice(2);
if (version === "analyze") {
  const all = readLog(target);
  const current = currentFiles(target);
  console.log(
    [...hotspotReport(all, current), "", ...couplingReport(all, current)].join("\n"),
  );
} else {
  const folder = join(tmpdir(), "morada");
  createRepository(folder);
  const all = readLog(folder);
  const current = currentFiles(folder);
  const lines = {
    history: () => historyReport(folder, all, current),
    hotspots: () => hotspotReport(all, current),
    coupling: () => couplingReport(all, current),
    "business-case": () => businessCaseReport(all, current),
  }[version];
  if (!lines) throw new Error(`unknown version: ${version}`);
  const text = lines().join("\n") + "\n";
  mkdirSync(join(target, version), { recursive: true });
  writeFileSync(join(target, version, "result.txt"), text);
  process.stdout.write(text);
}
