// The "flow" version: the same core, with the in-memory adapters and with the AWS
// ones (on LocalStack). The result must be the same; the calls are counted.
import { awsCloud } from "./aws.ts";
import { Counter, createClients } from "./clients.ts";
import { destroy, names, provision } from "./infra.ts";
import { PUBLICATIONS, fakePdf } from "./input.ts";
import { inMemoryCloud } from "./memory.ts";
import { write } from "./output.ts";
import type { Cloud } from "./ports.ts";
import { notifyResidents, publishReport } from "./report.ts";

async function run(cloud: Cloud) {
  const results: string[] = [];
  for (const [community, month] of PUBLICATIONS) {
    const pdf = fakePdf(community, month);
    results.push(await publishReport(cloud, community, month, pdf));
  }
  const notices = await notifyResidents(cloud);
  const docs = await cloud.documents.forCommunity("102");
  return { results, notices, docs: docs.length };
}

const counter = new Counter();
const c = createClients(counter);
const n = names();
await destroy(c, n);
await provision(c, n);
counter.reset();

const memory = await run(inMemoryCloud());
const aws = await run(await awsCloud(c, n));

const lines = [`${"".padEnd(28)}in memory   on AWS (LocalStack)`];
PUBLICATIONS.forEach(([community], i) => {
  const label = i > 0 && PUBLICATIONS[i - 1][0] === community ? " again" : "";
  lines.push(
    `community ${community}${label}`.padEnd(28) +
      memory.results[i].padEnd(12) +
      aws.results[i],
  );
});
lines.push(
  "notices sent".padEnd(28) +
    String(memory.notices.length).padEnd(12) +
    aws.notices.length,
);
lines.push("documents of 102".padEnd(28) + String(memory.docs).padEnd(12) + aws.docs);
for (const a of aws.notices) lines.push("  " + a);
const same = JSON.stringify(memory) === JSON.stringify(aws);
lines.push(`same result in both adapters: ${same ? "yes" : "NO"}`);
lines.push(`AWS calls in the flow: ${counter.total()}`);
for (const [key, count] of [...counter.calls].sort()) {
  lines.push(`  ${key.padEnd(26)}${count}`);
}
write("flow", lines);
