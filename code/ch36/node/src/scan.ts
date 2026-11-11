// A secret scan of the code, in the spirit of gitleaks and trufflehog: rules for
// known formats and for a variable name assigned a literal.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Finding {
  file: string;
  line: number;
  rule: string;
  sample: string; // only the start of the value: the report must not leak the secret
}

const RULES: [string, RegExp][] = [
  ["AWS access key", /\b(AKIA[0-9A-Z]{16})\b/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----()/],
  [
    "hardcoded secret",
    /(?:password|passwd|secret|token|apikey)\w*\s*[:=]\s*["']([^"']{8,})["']/i,
  ],
  ["URL with password", /\w+:\/\/[^:/\s]+:([^@/\s$]{4,})@/],
];

export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  text.split("\n").forEach((content, i) => {
    for (const [rule, re] of RULES) {
      const m = content.match(re);
      if (m) {
        const sample = m[1] ? `${m[1].slice(0, 4)}…` : "";
        findings.push({ file, line: i + 1, rule, sample });
      }
    }
  });
  return findings;
}

export function scanFolder(folder: string, prefix = folder): Finding[] {
  return readdirSync(folder, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      const path = join(folder, e.name);
      if (e.isDirectory()) return scanFolder(path, prefix);
      const relative = path.slice(prefix.length + 1);
      return scanText(relative, readFileSync(path, "utf8"));
    });
}
