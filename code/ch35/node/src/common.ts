// What the scenarios share: the verified output, the timings (outside the
// verification), and the database connection.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

export class Report {
  private lines: string[] = [];
  private timings: string[] = [];
  private start = performance.now();
  private root: string;
  private version: string;

  constructor(root: string, version: string) {
    this.root = root;
    this.version = version;
  }

  say(s = ""): void {
    this.lines.push(s);
    console.log(s);
  }

  // Real timings vary from machine to machine: they go to the terminal and to
  // output/timings, never to the result compared with the approved one
  mark(stage: string): void {
    const s = ((performance.now() - this.start) / 1000).toFixed(1);
    const line = `${stage.padEnd(48)}${s.padStart(7)} s`;
    this.timings.push(line);
    console.log(`   [time] ${line}`);
  }

  resetClock(): void {
    this.start = performance.now();
  }

  save(): void {
    const output = path.join(this.root, "output", this.version);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, "result.txt"), this.lines.join("\n") + "\n");
    if (this.timings.length === 0) return;
    const timings = path.join(this.root, "output", "timings");
    fs.mkdirSync(timings, { recursive: true });
    const file = path.join(timings, `${this.version}.txt`);
    fs.writeFileSync(file, this.timings.join("\n") + "\n");
  }
}

export async function connect(url: string): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  return c;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
