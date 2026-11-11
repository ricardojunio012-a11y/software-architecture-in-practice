// The "abandon" version: the worker receives the task and crashes before the ack.
// The port promises "at least once" delivery: on AWS, once the visibility
// timeout expires, the task comes back; the in-memory adapter breaks the promise.
import { setTimeout as sleep } from "node:timers/promises";
import { awsCloud } from "./aws.ts";
import { createClients } from "./clients.ts";
import { destroy, names, provision } from "./infra.ts";
import { inMemoryCloud } from "./memory.ts";
import { write } from "./output.ts";
import type { Cloud } from "./ports.ts";

async function abandon(cloud: Cloud) {
  await cloud.tasks.publish({
    type: "notify-residents",
    community: "104",
    month: "2026-10",
  });
  const first = await cloud.tasks.receive(10); // and the worker crashes here
  await sleep(3000); // the visibility timeout, 2 s, expires
  const second = await cloud.tasks.receive(10); // another worker tries
  return [first.length, second.length];
}

const c = createClients();
const n = names("abandon");
await destroy(c, n);
await provision(c, n, 2);
const [m1, m2] = await abandon(inMemoryCloud());
const [a1, a2] = await abandon(await awsCloud(c, n));
const column = (a: unknown, b: unknown) => String(a).padEnd(12) + String(b);
write("abandon", [
  "a worker receives the task and crashes before the ack; 3 s later, another tries",
  `${"".padEnd(32)}${column("in memory", "on AWS (LocalStack)")}`,
  "tasks on the first delivery".padEnd(32) + column(m1, a1),
  "tasks after the timeout".padEnd(32) + column(m2, a2),
  "the task was lost".padEnd(32) + column(m2 ? "no" : "yes", a2 ? "no" : "yes"),
]);
