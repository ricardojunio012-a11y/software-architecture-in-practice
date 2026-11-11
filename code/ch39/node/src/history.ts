// Generates Morada's simulated git history: 18 months (Jan. 2025 to Jun. 2026),
// with fixed authors and dates.
// The history has a hot, complex module (billing charges) and a hidden change
// coupling: the bookings rule reads a Billing table without importing anything from
// it, and the two change together. Everything comes from a generator with a fixed seed.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  ["Anna Lee", "anna"],
  ["Brian Reed", "brian"],
  ["Carol Davis", "carol"],
  ["David Moore", "david"],
  ["Ellen Parker", "ellen"],
  ["Frank Cole", "frank"],
  ["Grace Nolan", "grace"],
  ["Henry Allen", "henry"],
];

// Weight of each area: the chance that a commit touches it.
const AREAS: [string, number][] = [
  ["src/billing/charges.ts", 22],
  ["src/bookings/rules.ts", 8],
  ["src/billing/status.ts", 2],
  ["src/billing/invoices.ts", 6],
  ["src/billing/cards.ts", 7],
  ["src/bookings/calendar.ts", 7],
  ["src/frontdesk/visitors.ts", 8],
  ["src/frontdesk/packages.ts", 5],
  ["src/communications/notices.ts", 8],
  ["src/communications/notifier.ts", 5],
  ["src/directory/units.ts", 6],
  ["src/directory/residents.ts", 6],
  ["src/maintenance/requests.ts", 7],
  ["src/legacy/annual-report.ts", 1],
];

const CHARGES = "src/billing/charges.ts";
const RULES = "src/bookings/rules.ts";
const STATUS = "src/billing/status.ts";
const LEGACY = "src/legacy/annual-report.ts";

type Commit = {
  when: number; // seconds since 1970, UTC
  author: number;
  type: "feat" | "fix" | "refactor" | "style" | "chore";
  subject: string;
  hours: number;
  changes: Map<string, string>; // path -> new content
};

class SourceFile {
  path: string;
  lines: string[];
  rules = 0;
  constructor(path: string, header: string[]) {
    this.path = path;
    this.lines = [`// Morada: ${path}`, ...header, ""];
  }
  text(): string {
    return this.lines.join("\n") + "\n";
  }
  // A new rule: a function with nested ifs down to the given depth.
  addRule(depth: number) {
    const n = ++this.rules;
    const l = [`export function rule${n}(c: Case): number {`];
    l.push(`  const limit${n} = ${(n * 7) % 31};`);
    for (let p = 1; p <= depth; p++) {
      l.push(`${"  ".repeat(p)}if (c.field${p} > limit${n}) {`);
    }
    l.push(`${"  ".repeat(depth + 1)}return c.value * ${1 + n / 100};`);
    for (let p = depth; p >= 1; p--) l.push(`${"  ".repeat(p)}}`);
    l.push("  return c.value;", "}", "");
    this.lines.push(...l);
  }
  // A fix: changes the value of an existing limit.
  fix(draw: () => number) {
    const targets = this.lines
      .map((t, i) => (/const limit\d+ = \d+;/.test(t) ? i : -1))
      .filter((i) => i >= 0);
    if (targets.length === 0) return this.addRule(1);
    const i = targets[Math.floor(draw() * targets.length)];
    const value = Math.floor(draw() * 90) + 1;
    this.lines[i] = this.lines[i].replace(/= \d+;/, `= ${value};`);
  }
}

function pick<T>(items: [T, number][], draw: () => number): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = draw() * total;
  for (const [item, weight] of items) {
    r -= weight;
    if (r < 0) return item;
  }
  return items[items.length - 1][0];
}

function moduleOf(path: string) {
  return path.split("/")[1];
}

export function plan(seed = 39): Commit[] {
  const draw = seededRandom(seed);
  const files = new Map<string, SourceFile>();
  for (const [path] of AREAS) {
    const header = ['import type { Case } from "../types.ts";'];
    if (path === CHARGES) header.push('import { issueInvoice } from "./invoices.ts";');
    if (path === RULES) {
      // The hidden coupling: it reads the Billing table without importing the module.
      header.push('const IN_ARREARS = "SELECT in_arrears FROM billing.unit_status";');
    }
    files.set(path, new SourceFile(path, header));
  }
  for (const f of files.values()) {
    const initial = f.path === LEGACY ? 40 : f.path === CHARGES ? 6 : 3;
    for (let k = 0; k < initial; k++) f.addRule(f.path === LEGACY ? 5 : 2);
  }
  const commits: Commit[] = [];
  // Monday, Jan. 6, 2025, 9:00 a.m. US Eastern time (EST, UTC-5)
  const start = Date.UTC(2025, 0, 6, 14) / 1000;
  const all = () => new Map([...files].map(([p, f]) => [p, f.text()]));
  commits.push({
    when: start,
    author: 0,
    type: "chore",
    subject: "chore: import the code from the old repository",
    hours: 2,
    changes: all(),
  });

  let pending: string | null = null; // fix for a forgotten coupling
  for (let week = 0; week < 77; week++) {
    if (week === 36) {
      for (const f of files.values()) f.lines[0] += " (formatted)";
      commits.push({
        when: start + week * 604800 + 86400,
        author: 7,
        type: "style",
        subject: "style: run the formatter on all the code",
        hours: 1,
        changes: all(),
      });
    }
    const count = 3 + Math.floor(draw() * 5);
    const moments = Array.from({ length: count }, () => {
      const day = Math.floor(draw() * 5);
      const hour = 9 + Math.floor(draw() * 9);
      const minute = Math.floor(draw() * 60);
      // US Eastern time; start is already 9:00 a.m.
      return start + week * 604800 + day * 86400 + (hour - 9) * 3600 + minute * 60;
    }).sort((x, y) => x - y);
    for (const when of moments) {
      let area = pick(AREAS, draw);
      let type: Commit["type"];
      const touched = new Set<string>();
      const forgotten = pending !== null;
      if (pending) {
        area = pending;
        pending = null;
        type = "fix";
        touched.add(STATUS).add(RULES);
      } else {
        const fixChance = area === CHARGES ? 0.45 : 0.2;
        const r = draw();
        type = r < fixChance ? "fix" : r < 0.88 ? "feat" : "refactor";
        touched.add(area);
        if (area === RULES) {
          if (draw() < 0.8) touched.add(STATUS);
          else pending = RULES; // forgot the other side: a fix will follow
        }
        if (area === STATUS && draw() < 0.5) touched.add(RULES);
        if (area === CHARGES && draw() < 0.3) touched.add("src/billing/invoices.ts");
      }
      for (const path of touched) {
        const f = files.get(path)!;
        if (type === "feat") {
          const depth =
            path === CHARGES ? Math.min(6, 2 + Math.floor(f.rules / 12)) : 2;
          f.addRule(depth);
        } else f.fix(draw);
      }
      const charges = files.get(CHARGES)!;
      const factor = touched.has(CHARGES)
        ? 1 + charges.lines.length / 250
        : touched.has(RULES)
          ? 1.5
          : 1;
      const base = { feat: 6, fix: 3, refactor: 4, style: 1, chore: 1 }[type];
      const hours = Math.max(1, Math.round(base * factor * (0.7 + 0.6 * draw())));
      const author =
        area === CHARGES
          ? pick<number>(
              [
                [0, 60],
                [1, 25],
                [2, 5],
                [3, 5],
                [4, 5],
              ],
              draw,
            )
          : Math.floor(draw() * PEOPLE.length);
      const file = area.split("/")[2];
      const subject = forgotten
        ? "fix(bookings): a unit in arrears could still book"
        : `${type}(${moduleOf(area)}): ` +
          (type === "feat" ? `new rule in ${file}` : `adjustment in ${file}`);
      commits.push({
        when,
        author,
        type,
        subject,
        hours,
        changes: new Map([...touched].map((p) => [p, files.get(p)!.text()])),
      });
    }
  }
  return commits;
}

// Builds the git fast-import stream: one commit after another, with the full content.
function importStream(commits: Commit[]): Buffer {
  const parts: string[] = [];
  const data = (s: string) => `data ${Buffer.byteLength(s)}\n${s}\n`;
  commits.forEach((c, i) => {
    const [name, user] = PEOPLE[c.author];
    const who = `${name} <${user}@morada.example> ${c.when} -0500`;
    const message = `${c.subject}\n\nHours: ${c.hours}\n`;
    parts.push(`commit refs/heads/main\nmark :${i + 1}\n`);
    parts.push(`author ${who}\ncommitter ${who}\n${data(message)}`);
    if (i > 0) parts.push(`from :${i}\n`);
    for (const [path, text] of c.changes) {
      parts.push(`M 100644 inline ${path}\n${data(text)}`);
    }
  });
  return Buffer.from(parts.join(""));
}

export function createRepository(folder: string, seed = 39): number {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", args, { cwd: folder });
  git("init", "-q", "-b", "main");
  const commits = plan(seed);
  execFileSync("git", ["fast-import", "--quiet"], {
    cwd: folder,
    input: importStream(commits),
  });
  git("checkout", "-q", "-f", "main");
  return commits.length;
}
