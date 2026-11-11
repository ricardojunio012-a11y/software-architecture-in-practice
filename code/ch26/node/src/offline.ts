// The "offline" version: the front-desk device records 10 gate entries. From the 4th to
// the 7th, it has no network, and the entries wait in the local queue. When it comes
// back, it resends the last entry already confirmed by mistake (as if the confirmation
// had been lost). The server is also down for a while, and the broker keeps the
// messages of its session.
import fs from "node:fs";
import path from "node:path";
import mqtt from "mqtt";
import { type Entry, LocalQueue, Receiver } from "./device.ts";

const URL = process.env.MQTT_URL!;
const TOPIC = "frontdesk/12/entries";
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const entry = (n: number): Entry => ({
  id: `frontdesk-1:${n}`,
  plate: `ABC${String(n).padStart(4, "0")}`,
  time: `2026-11-05T08:${String(n).padStart(2, "0")}:00`,
});

// The server, on MQTT 5: Clean Start off (clean: false) resumes any existing session,
// and the Session Expiry Interval says how long the broker keeps it after the
// connection drops. Without it (or with 0), the session ends with the connection, and
// whatever arrives while the server is down is lost.
const receiver = new Receiver();
const serverOptions = {
  clientId: "morada-server",
  protocolVersion: 5 as const,
  clean: false,
  properties: { sessionExpiryInterval: 3600 }, // one hour, in seconds
};
// The handler goes in before connecting: the broker delivers what it kept right away
async function startServer() {
  const server = mqtt.connect(URL, serverOptions);
  server.on("message", (_t, m) => receiver.receive(JSON.parse(m.toString())));
  await new Promise((ok) => server.once("connect", ok));
  await server.subscribeAsync(TOPIC, { qos: 1 });
  return server;
}

let server = await startServer();
fs.rmSync("/tmp/frontdesk.db", { force: true });
const queue = new LocalQueue("/tmp/frontdesk.db");
const deviceOptions = { clientId: "frontdesk-1", protocolVersion: 5 as const };
let device = await mqtt.connectAsync(URL, deviceOptions);
const lines: string[] = [];

for (let n = 1; n <= 3; n++) queue.record(entry(n));
await queue.drain(device, TOPIC);

await device.endAsync(); // the front-desk network went down
for (let n = 4; n <= 7; n++) queue.record(entry(n));
lines.push(`no network: entries 4 to 7 in the local queue (${queue.size} pending)`);

await wait(500); // the server confirms to the broker what it has already received
await server.endAsync(); // and the Morada server restarts
device = await mqtt.connectAsync(URL, deviceOptions);
await queue.drain(device, TOPIC);
lines.push(`the network is back: local queue drained (${queue.size} pending)`);

// The confirmation of entry 7 "was lost", and the device sends it again
await device.publishAsync(TOPIC, JSON.stringify(entry(7)), { qos: 1 });
for (let n = 8; n <= 10; n++) queue.record(entry(n));
await queue.drain(device, TOPIC);

server = await startServer(); // the server comes back and gets what the broker kept
await wait(1000);
lines.push(
  `the server received ${receiver.received.length} entries, in order: ` +
    receiver.received.map((e) => e.id.split(":")[1]).join(", "),
  `duplicates ignored: ${receiver.duplicates}`,
);

await Promise.all([device.endAsync(), server.endAsync()]);
queue.close();
const output = path.join(process.argv[2], "output", "offline");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
