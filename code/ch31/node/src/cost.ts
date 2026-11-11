// The "cost" version: what the abstraction costs in lines of code and in calls
// to AWS, comparing the version with ports and the direct version, without ports.
import fs from "node:fs";
import path from "node:path";
import { awsCloud } from "./aws.ts";
import { Counter, createClients } from "./clients.ts";
import { notifyDirect, publishDirect, queueUrl } from "./direct.ts";
import { destroy, names, provision } from "./infra.ts";
import { PUBLICATIONS, fakePdf } from "./input.ts";
import { write } from "./output.ts";
import { notifyResidents, publishReport } from "./report.ts";

// Lines of code: no blank lines and no whole-line comments
function measure(file: string) {
  const text = fs.readFileSync(path.join(import.meta.dirname, file), "utf8");
  const lines = text.split("\n").map((l) => l.trim());
  const code = lines.filter((l) => l !== "" && !l.startsWith("//"));
  return { lines: code.length, sdk: text.includes("@aws-sdk/") };
}

const parts: [string, string][] = [
  ["core", "report.ts"],
  ["ports", "ports.ts"],
  ["AWS adapters", "aws.ts"],
  ["in-memory adapters", "memory.ts"],
  ["direct version, no ports", "direct.ts"],
];
const m = Object.fromEntries(parts.map(([, file]) => [file, measure(file)]));
const lines = [`${"".padEnd(42)} lines  uses the SDK`];
for (const [name, file] of parts) {
  const { lines: n, sdk } = m[file];
  lines.push(
    `${name} (${file})`.padEnd(42) +
      String(n).padStart(6) +
      "  " +
      (sdk ? "yes" : "no"),
  );
}
const withPorts = m["report.ts"].lines + m["ports.ts"].lines + m["aws.ts"].lines;
const direct = m["direct.ts"].lines;
const times = (withPorts / direct).toFixed(1);
lines.push(
  `with ports (core + ports + AWS): ${withPorts} lines; direct: ${direct}` +
    ` (${times} times)`,
);

// Morada's files that know AWS: they are the ones that change when the vendor
// changes. The lab's own scripts stay out of the count
const scripts = ["direct.ts", "cost.ts", "provision.ts", "flow.ts", "abandon.ts"];
const fromAws = fs
  .readdirSync(import.meta.dirname)
  .filter((a) => a.endsWith(".ts") && !scripts.includes(a) && measure(a).sdk)
  .sort();
lines.push(`Morada files that import the SDK: ${fromAws.join(", ")}`);

// The calls to AWS, in the same flow, in both versions
const counter = new Counter();
const c = createClients(counter);
const n = names();
async function calls(flow: () => Promise<unknown>) {
  await destroy(c, n);
  await provision(c, n);
  counter.reset();
  await flow();
  return counter.total();
}
const directCalls = await calls(async () => {
  const url = await queueUrl(c, n);
  for (const [community, month] of PUBLICATIONS) {
    await publishDirect(c, n, url, community, month, fakePdf(community, month));
  }
  await notifyDirect(c, n, url);
});
const portCalls = await calls(async () => {
  const cloud = await awsCloud(c, n);
  for (const [community, month] of PUBLICATIONS) {
    await publishReport(cloud, community, month, fakePdf(community, month));
  }
  await notifyResidents(cloud);
});
lines.push(
  `AWS calls in the same flow: direct ${directCalls}, with ports ${portCalls}`,
);
write("cost", lines);
