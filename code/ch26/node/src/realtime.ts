// The "realtime" version: the resident of A-101 is connected to api1 and the resident
// of B-202 to api2. The front-desk staff register both visitors through api1, first
// without and then with Redis pub/sub between the replicas.
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// The replicas may still be starting: retry until they answer
async function request(url: string, method = "GET") {
  for (;;) {
    try {
      return await fetch(url, { method });
    } catch {
      await wait(300);
    }
  }
}

async function connect(replica: string, unit: string, received: string[]) {
  for (;;) {
    try {
      const ws = new WebSocket(`ws://${replica}:3000/?unit=${unit}`);
      await new Promise((ok, fail) => {
        ws.on("message", (m) => {
          if (m.toString() === "connected") ok(null);
          else received.push(m.toString());
        });
        ws.on("error", fail);
      });
      return ws;
    } catch {
      await wait(300); // the replica is still starting
    }
  }
}

const lines: string[] = [];
for (const withRedis of [false, true]) {
  for (const r of ["api1", "api2"]) {
    await request(`http://${r}:3000/mode?redis=${withRedis ? "yes" : "no"}`);
  }
  const forA: string[] = [];
  const forB: string[] = [];
  const a = await connect("api1", "A-101", forA);
  const b = await connect("api2", "B-202", forB);
  for (const [unit, name] of [
    ["A-101", "Carol"],
    ["B-202", "David"],
  ]) {
    await request(`http://api1:3000/visitors?unit=${unit}&name=${name}`, "POST");
  }
  await wait(500);
  lines.push(
    `== ${withRedis ? "with" : "without"} pub/sub between the replicas`,
    `resident of A-101 (connected to api1): ${forA.join("; ") || "nothing"}`,
    `resident of B-202 (connected to api2): ${forB.join("; ") || "nothing"}`,
    "",
  );
  a.close();
  b.close();
}

const output = path.join(process.argv[2], "output", "realtime");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n"));
console.log(lines.join("\n"));
