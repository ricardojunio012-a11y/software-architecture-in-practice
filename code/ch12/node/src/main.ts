// Usage: node main.ts monolith|service <output-folder>
// Sends one notice per confirmed payment: through the module, in the same process,
// or through the extracted service, over the network. Counts what happened and
// measures the time of each notice.
import fs from "node:fs";
import path from "node:path";
import { Communications } from "./communications.ts";

const [version, outDir] = process.argv.slice(2);
const { notices } = JSON.parse(fs.readFileSync("/data/input/load.json", "utf8"));
const url = process.env.COMMUNICATIONS_URL;
const count = {
  sent: 0,
  calls: 0,
  errors: 0,
  retries: 0,
  duplicates: 0,
  lost: 0,
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// Over the network, each call can fail: try up to 3 times, always with the same id
async function sendOverNetwork(id: string, text: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      count.retries += 1;
      // Growing backoff (5 to 10 ms, then 10 to 20 ms), with jitter, so that
      // clients that failed together do not all come back at the same instant
      const cap = 10 * 2 ** (attempt - 2);
      await sleep(cap / 2 + Math.random() * (cap / 2));
    }
    count.calls += 1;
    try {
      const response = await fetch(`${url}/notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text }),
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const body = await response.json();
        if (body.status === "duplicate") count.duplicates += 1;
        count.sent += 1;
        return;
      }
      count.errors += 1;
    } catch {
      count.errors += 1;
    }
  }
  count.lost += 1;
}

const communications = new Communications();
if (version === "service") await fetch(`${url}/reset`, { method: "POST" });
const times: number[] = [];
const start = performance.now();
for (let i = 1; i <= notices; i++) {
  const id = `E-P-${String(i).padStart(3, "0")}`;
  const text = `payment ${id.slice(2)} received`;
  const t0 = performance.now();
  if (version === "service") {
    await sendOverNetwork(id, text);
  } else if (communications.send(id, text)) {
    count.sent += 1;
  }
  times.push(performance.now() - t0);
}
const total = performance.now() - start;

const sorted = [...times].sort((a, b) => a - b);
const ms = (v: number) => `${v.toFixed(3)} ms`;
fs.mkdirSync(path.join(outDir, version), { recursive: true });
fs.writeFileSync(
  path.join(outDir, version, "result.txt"),
  [
    `notices sent: ${count.sent}`,
    `network calls: ${count.calls}`,
    `error responses: ${count.errors}`,
    `retries: ${count.retries}`,
    `duplicate notices ignored: ${count.duplicates}`,
    `notices lost: ${count.lost}`,
  ].join("\n") + "\n",
);
// Times vary from machine to machine: they stay out of the verified folder
fs.writeFileSync(
  path.join(outDir, `times-${version}.txt`),
  [
    `mean time per notice: ${ms(times.reduce((a, b) => a + b, 0) / times.length)}`,
    `p95 per notice: ${ms(sorted[Math.floor(sorted.length * 0.95)])}`,
    `worst notice: ${ms(sorted[sorted.length - 1])}`,
    `total time: ${ms(total)}`,
  ].join("\n") + "\n",
);
console.log(`${version}: ${count.sent} notices; output in ${outDir}/${version}`);
