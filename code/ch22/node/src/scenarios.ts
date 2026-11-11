// The scenarios that go through the load balancer. A board president logs in and
// opens the dashboard several times, one request after another, and each response
// says which replica served it.
import fs from "node:fs";
import path from "node:path";

const [data, scenario] = process.argv.slice(2);
const BALANCER = "http://balancer";
const REPLICAS = ["api1", "api2", "api3"];
const admin = (replica: string, route: string) =>
  fetch(`http://${replica}:3001${route}`).then((r) => r.text());

// Prepare the replicas: all up, counters reset, sessions in the chosen store
const mode = scenario === "memory-session" ? "memory" : "redis";
for (const r of REPLICAS) {
  await admin(r, "/start");
  await admin(r, `/mode?session=${mode}`);
}
// Wait for the load balancer to use all the replicas again (fail_timeout is 30 s)
await new Promise((ok) => setTimeout(ok, 31_000));
for (const r of REPLICAS) await admin(r, "/reset");

const login = await fetch(`${BALANCER}/login`, { method: "POST" });
const sid = login.headers.get("set-cookie")!.split(";")[0];

const lines: string[] = [`scenario: ${scenario}`, "1 login"];
const status = new Map<string, number>();
const requests = scenario === "crash" ? 30 : 9;
let beforeCrash: number[] = [];
for (let i = 1; i <= requests; i++) {
  if (scenario === "crash" && i === 11) {
    beforeCrash = await Promise.all(
      REPLICAS.map((r) => admin(r, "/reset").then(Number)),
    );
    await admin("api2", "/stop");
    lines.push("after the 10th request: api2 stops accepting connections");
  }
  const r = await fetch(`${BALANCER}/dashboard`, { headers: { cookie: sid } });
  status.set(String(r.status), (status.get(String(r.status)) ?? 0) + 1);
}

const counts = await Promise.all(REPLICAS.map((r) => admin(r, "/reset").then(Number)));
lines.push(
  `${requests} dashboard requests: ` +
    [...status]
      .sort()
      .map(([s, n]) => `${n} with status ${s}`)
      .join(", "),
);
if (scenario === "crash") {
  const before = beforeCrash.sort((a, b) => b - a).join(", ");
  lines.push(
    `before the crash, requests per replica (including the login): ${before}`,
    `after the crash: api2 served ${counts[1]}; ` +
      `api1 and api3 served ${counts[0] + counts[2]}`,
  );
} else {
  const sorted = [...counts].sort((a, b) => b - a);
  lines.push(`requests per replica, including the login: ${sorted.join(", ")}`);
}

await admin("api2", "/start");
const output = path.join(data, "output", scenario);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
