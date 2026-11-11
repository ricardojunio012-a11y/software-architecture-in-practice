// Reads the history of a git repository: who changed what, when, and in how many hours.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Change = {
  author: string;
  date: string; // YYYY-MM-DD
  subject: string;
  hours: number | null; // from the "Hours:" trailer, when present
  files: string[];
};

// Start of a commit in the log; the rest of the lines are the --numstat output.
const FORMAT = "--format=@@%x09%an%x09%as%x09%s%x09%(trailers:key=Hours,valueonly)";

export function readLog(repo: string): Change[] {
  const output = execFileSync(
    "git",
    // safe.directory: the repository mounted in the container has another owner
    [
      "-c",
      "safe.directory=*",
      "log",
      "--reverse",
      "--no-merges",
      "--no-renames",
      "--numstat",
      FORMAT,
    ],
    { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 },
  );
  return parseLog(output);
}

export function parseLog(output: string): Change[] {
  const changes: Change[] = [];
  for (const line of output.split("\n")) {
    if (line.startsWith("@@\t")) {
      const [, author, date, subject, hours] = line.split("\t");
      const h = Number.parseFloat(hours ?? "");
      changes.push({
        author,
        date,
        subject,
        hours: Number.isNaN(h) ? null : h,
        files: [],
      });
    } else if (/^(\d+|-)\t(\d+|-)\t/.test(line)) {
      changes[changes.length - 1].files.push(line.split("\t")[2]);
    }
  }
  return changes;
}

export function currentFiles(repo: string): Map<string, string> {
  const list = execFileSync("git", ["-c", "safe.directory=*", "ls-files"], {
    cwd: repo,
    encoding: "utf8",
  });
  const content = new Map<string, string>();
  for (const path of list.split("\n").filter(Boolean)) {
    content.set(path, readFileSync(join(repo, path), "utf8"));
  }
  return content;
}
