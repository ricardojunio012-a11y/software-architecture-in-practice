// The "restart" version (now the hard part): the front-desk device has no network,
// records three gate entries and restarts (a power outage) before the network comes
// back. A child process plays the device and is killed with SIGKILL, with no chance to
// save anything. Then a new device opens the same queue and drains it. With the
// in-memory queue, the entries vanish; with the queue in a SQLite file, all arrive.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import mqtt from "mqtt";
import { type Entry, LocalQueue, Receiver } from "./device.ts";

const [data, role, file] = process.argv.slice(2);
const TOPIC = "frontdesk/12/entries-restart";
const entry = (n: number): Entry => ({
  id: `frontdesk-2:${n}`,
  plate: `XYZ${String(n).padStart(4, "0")}`,
  time: `2026-11-05T09:${String(n).padStart(2, "0")}:00`,
});

if (role === "device") {
  // No network: it only writes to the local queue, and the process dies closing nothing
  const queue = new LocalQueue(file);
  for (let n = 21; n <= 23; n++) queue.record(entry(n));
  process.kill(process.pid, "SIGKILL");
  await new Promise(() => {}); // does not go on while the signal arrives
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const receiver = new Receiver();
const options = { protocolVersion: 5 as const };
const server = await mqtt.connectAsync(process.env.MQTT_URL!, {
  ...options,
  clientId: "morada-server-restart",
});
server.on("message", (_t, m) => receiver.receive(JSON.parse(m.toString())));
await server.subscribeAsync(TOPIC, { qos: 1 });

const lines: string[] = [];
const modes = [
  ["memory", ":memory:"],
  ["a SQLite file", "/tmp/frontdesk-restart.db"],
];
for (const [name, location] of modes) {
  fs.rmSync(location, { force: true });
  receiver.received.length = 0;
  const child = spawnSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      process.argv[1],
      data,
      "device",
      location,
    ],
    { stdio: "inherit" },
  );
  // The device powers back on, opens the same queue and drains it when the network
  // comes back
  const queue = new LocalQueue(location);
  const survived = queue.size;
  const device = await mqtt.connectAsync(process.env.MQTT_URL!, {
    ...options,
    clientId: "frontdesk-2",
  });
  await queue.drain(device, TOPIC);
  for (let i = 0; i < 20 && receiver.received.length < survived; i++) await wait(100);
  await device.endAsync();
  queue.close();
  const ids = receiver.received.map((e) => e.id.split(":")[1]);
  lines.push(
    `== queue in ${name}`,
    `the device recorded 3 entries with no network and died (${child.signal})`,
    `entries in the queue after powering back on: ${survived}`,
    `the server received: ${ids.length ? ids.join(", ") : "none"}`,
    "",
  );
}

await server.endAsync();
const output = path.join(data, "output", "restart");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n"));
console.log(lines.join("\n"));
