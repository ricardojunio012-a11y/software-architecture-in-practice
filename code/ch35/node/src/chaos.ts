// Scenario "chaos": take down replicas of the notices API during traffic and
// check the steady-state hypothesis.
import http from "node:http";
import { Report } from "./common.ts";
import { Balancer, type Replica } from "./balancer.ts";
import * as av from "./availability.ts";

const report = new Report(process.argv[2], "chaos");
const REQUESTS = 1000;
const FAILURE_AT = 500; // the failure is injected after this request
const HYPOTHESIS = 0.999;

const r1 = { name: "api-1", zone: "a" };
const r2 = { name: "api-2", zone: "a" };
const r3 = { name: "api-3", zone: "b" };
const all = [r1, r2, r3];

// A new connection per request (agent: false), so the replica taken down refuses
// at once, with no old connections reused
const httpGet = (host: string, port: number, urlPath: string) =>
  new Promise<boolean>((ok) => {
    const p = http.get({ host, port, path: urlPath, agent: false }, (res) => {
      res.resume();
      res.on("end", () => ok(res.statusCode === 200));
    });
    p.setTimeout(1000, () => p.destroy());
    p.on("error", () => ok(false));
  });

const transport = (r: Replica) => httpGet(r.name, 8080, "/notices");
const admin = async (rs: Replica[], action: string) => {
  for (const r of rs) await httpGet(r.name, 9090, `/chaos/${action}`);
};

async function experiment(
  name: string,
  replicas: Replica[],
  tryAnother: boolean,
  kill: Replica[],
): Promise<void> {
  await admin(all, "restore");
  const lb = new Balancer(replicas, transport, tryAnother);
  let answered = 0;
  for (let i = 1; i <= REQUESTS; i++) {
    if (i === FAILURE_AT + 1) await admin(kill, "kill");
    if (await lb.request()) answered++;
  }
  await admin(all, "restore");
  const a = answered / REQUESTS;
  const hypothesis = a >= HYPOTHESIS ? "holds" : "refuted";
  const result = `${answered} of ${REQUESTS}`.padStart(12);
  report.say(
    `${name.padEnd(46)}${result}${av.percent(a, 1).padStart(8)}  ${hypothesis}`,
  );
}

report.say(`Morada: chaos experiment on the notices API (${REQUESTS} requests each)`);
report.say("Steady-state hypothesis: at least 99.9% of requests answered");
report.say(`The failure is injected after request ${FAILURE_AT}.`);
report.say();
const header = "experiment".padEnd(46) + "answered".padStart(12);
report.say(`${header}${"avail.".padStart(8)}  hypothesis`);
await experiment("baseline: api-1 (a) and api-3 (b)", [r1, r3], false, []);
await experiment("api-1 dies; balancer does not try another", [r1, r3], false, [r1]);
await experiment("api-1 dies; balancer tries the other", [r1, r3], true, [r1]);
await experiment("zone a dies: api-1 (a) and api-2 (a)", [r1, r2], true, [r1, r2]);
await experiment("zone a dies: api-1 (a) and api-3 (b)", [r1, r3], true, [r1, r2]);

report.say();
report.say("The math of section 35.1, with 99.5% replicas and 99.9% zones (premises):");
const line = (name: string, p: number) =>
  report.say(
    `  ${name.padEnd(44)}${av.percent(p, 4).padStart(10)}` +
      `${av.hoursDownPerYear(p).toFixed(1).padStart(8)} h/year`,
  );
line("one replica", 0.995);
line("two independent replicas", av.inParallel([0.995, 0.995]));
line("two replicas in the same zone", av.withShared(0.999, [0.995, 0.995]));
line(
  "two replicas, each in its own zone",
  av.inParallel([av.inSeries([0.999, 0.995]), av.inSeries([0.999, 0.995])]),
);
report.save();
