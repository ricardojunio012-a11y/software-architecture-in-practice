// Hotspots and change coupling, from the history.
import type { Change } from "./git.ts";

// Commits that touch many files (import, formatting, license change) say nothing
// about the design and create false couplings: they are left out.
export const MAX_FILES = 10;

export function dropLarge(changes: Change[], max = MAX_FILES) {
  return changes.filter((c) => c.files.length <= max);
}

// Complexity from indentation: the sum of the indentation levels of non-empty lines.
// It does not depend on the language and tracks the costlier metrics well (Tornhill).
export function complexity(text: string, spacesPerLevel = 2): number {
  let total = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    total += Math.floor(indent / spacesPerLevel);
  }
  return total;
}

export type Hotspot = {
  file: string;
  revisions: number;
  lines: number;
  complexity: number;
  priority: number; // 0 to 100
  mainAuthor: string;
  authorShare: number; // fraction of the file's commits
};

export function hotspots(changes: Change[], current: Map<string, string>): Hotspot[] {
  const revisions = new Map<string, number>();
  const authors = new Map<string, Map<string, number>>();
  for (const c of changes) {
    for (const f of c.files) {
      if (!current.has(f)) continue; // a file that no longer exists
      revisions.set(f, (revisions.get(f) ?? 0) + 1);
      const byAuthor = authors.get(f) ?? new Map<string, number>();
      byAuthor.set(c.author, (byAuthor.get(c.author) ?? 0) + 1);
      authors.set(f, byAuthor);
    }
  }
  const list = [...revisions].map(([file, n]) => {
    const text = current.get(file)!;
    const [author, times] = [...authors.get(file)!].sort(
      (x, y) => y[1] - x[1] || x[0].localeCompare(y[0]),
    )[0];
    return {
      file,
      revisions: n,
      lines: text.split("\n").filter((l) => l.trim() !== "").length,
      complexity: complexity(text),
      priority: 0,
      mainAuthor: author,
      authorShare: times / n,
    };
  });
  // Priority: change frequency × complexity, both relative to the largest value.
  const maxRev = Math.max(...list.map((h) => h.revisions));
  const maxCx = Math.max(...list.map((h) => h.complexity));
  for (const h of list) {
    h.priority = Math.round((100 * h.revisions * h.complexity) / (maxRev * maxCx));
  }
  return list.sort((x, y) => y.priority - x.priority || x.file.localeCompare(y.file));
}

export type Pair = {
  a: string;
  b: string;
  together: number; // commits in which both changed
  degree: number; // together ÷ average revisions of the two, from 0 to 1
};

// Change coupling: pairs of files that change in the same commits.
export function changeCoupling(
  changes: Change[],
  minTogether = 5,
  minDegree = 0.3,
): Pair[] {
  const revisions = new Map<string, number>();
  const together = new Map<string, number>();
  for (const c of changes) {
    const files = [...new Set(c.files)].sort();
    for (const f of files) revisions.set(f, (revisions.get(f) ?? 0) + 1);
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = `${files[i]}\t${files[j]}`;
        together.set(key, (together.get(key) ?? 0) + 1);
      }
    }
  }
  const pairs: Pair[] = [];
  for (const [key, n] of together) {
    const [a, b] = key.split("\t");
    const average = (revisions.get(a)! + revisions.get(b)!) / 2;
    const degree = n / average;
    if (n >= minTogether && degree >= minDegree) {
      pairs.push({ a, b, together: n, degree });
    }
  }
  return pairs.sort((x, y) => y.degree - x.degree || y.together - x.together);
}

// Does the coupling show in the code? Looks for an import of one file in the other.
export function imports(text: string, target: string): boolean {
  const name = target.split("/").pop()!.replace(/\.ts$/, "");
  return new RegExp(`^import .* from ".*/${name}(\\.ts)?";`, "m").test(text);
}
