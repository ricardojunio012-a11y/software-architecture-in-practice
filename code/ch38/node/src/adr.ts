// The decision log: reads the ADRs in Markdown and checks the format, the numbering
// and the supersession links. The problems come out as text, one per line.
import fs from "node:fs";
import path from "node:path";

export type Adr = {
  file: string;
  number: number; // the number in the title
  title: string;
  status: string;
  date: string;
  supersedes?: number;
  sections: string[];
};

export const SECTIONS = [
  "Context",
  "Decision",
  "Alternatives considered",
  "Consequences",
  "When to revisit",
];
const STATUSES = /^(proposed|accepted|deprecated|superseded by ADR-(\d{3}))$/;

const id = (n: number) => `ADR-${String(n).padStart(3, "0")}`;

// Reads one ADR. Whatever is missing stays empty, and the validation points it out.
export function readAdr(file: string, text: string): Adr {
  const title = text.match(/^# ADR-(\d{3}): (.+)$/m);
  const field = (name: string) =>
    text.match(new RegExp(`^- ${name}: (.+)$`, "m"))?.[1].trim() ?? "";
  const supersedes = field("Supersedes").match(/^ADR-(\d{3})$/);
  return {
    file,
    number: title ? Number(title[1]) : NaN,
    title: title ? title[2] : "",
    status: field("Status"),
    date: field("Date"),
    supersedes: supersedes ? Number(supersedes[1]) : undefined,
    sections: [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
  };
}

export function readLog(folder: string): Adr[] {
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => readAdr(name, fs.readFileSync(path.join(folder, name), "utf8")));
}

// A fitness function declares the ADR it protects
export type Link = { fn: string; adr: number };

export function validate(adrs: Adr[], links: Link[] = []): string[] {
  const problems: string[] = [];
  const byNumber = new Map<number, Adr[]>();
  for (const a of adrs) {
    // Format: the file name and the title give the same number
    const fromFile = a.file.match(/^adr-(\d{3})-[a-z0-9-]+\.md$/);
    if (!fromFile) problems.push(`${a.file}: name does not follow adr-NNN-name.md`);
    else if (Number(fromFile[1]) !== a.number)
      problems.push(`${a.file}: the title says ${id(a.number)}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date))
      problems.push(`${a.file}: date missing or not in YYYY-MM-DD format`);
    if (!STATUSES.test(a.status))
      problems.push(`${a.file}: invalid status "${a.status}"`);
    const missing = SECTIONS.filter((s) => !a.sections.includes(s));
    if (missing.length) problems.push(`${a.file}: missing section "${missing[0]}"`);
    else if (a.sections.join() !== SECTIONS.join())
      problems.push(`${a.file}: sections out of order`);
    if (fromFile) {
      const n = Number(fromFile[1]);
      byNumber.set(n, [...(byNumber.get(n) ?? []), a]);
    }
  }
  // Numbering: one number, one ADR
  for (const [n, list] of byNumber)
    if (list.length > 1)
      problems.push(
        `${id(n)}: number repeated in ${list.map((a) => a.file).join(" and ")}`,
      );

  // Supersession: the link holds in both directions
  const single = (n: number) => byNumber.get(n)?.[0];
  for (const a of adrs) {
    const n = Number(a.file.match(/^adr-(\d{3})/)?.[1] ?? a.number);
    if (a.supersedes !== undefined) {
      const old = single(a.supersedes);
      if (!old)
        problems.push(`${id(n)}: supersedes ${id(a.supersedes)}, which does not exist`);
      else if (old.status !== `superseded by ${id(n)}`)
        problems.push(
          `${id(n)}: supersedes ${id(a.supersedes)}, which is still "${old.status}"`,
        );
      if (a.supersedes > n) problems.push(`${id(n)}: supersedes a newer ADR`);
    }
    const by = a.status.match(STATUSES)?.[2];
    if (by && single(Number(by))?.supersedes !== n)
      problems.push(
        `${id(n)}: says it was superseded by ADR-${by}, which does not say so`,
      );
  }

  // Fitness functions: each one protects a decision in force
  for (const l of links) {
    const adr = single(l.adr);
    if (!adr) problems.push(`function ${l.fn}: ${id(l.adr)} does not exist`);
    else if (adr.status !== "accepted")
      problems.push(`function ${l.fn}: ${id(l.adr)} is "${adr.status}"`);
  }
  return problems;
}

// The log's index is generated, never written by hand
export function index(adrs: Adr[]): string {
  const lines = [
    "# Morada decision log",
    "",
    "| ADR | Decision | Status | Date |",
    "|---|---|---|---|",
  ];
  for (const a of adrs)
    lines.push(`| ${id(a.number)} | ${a.title} | ${a.status} | ${a.date} |`);
  return lines.join("\n") + "\n";
}

export { id as adrName };
