// Step 5: Acacia Grove moves to Morada, the unused route is turned off, and the first
// part of the legacy leaves for good: Acacia Grove's data is archived and deleted
// from it.
import { createHash } from "node:crypto";
import { setUp, useApp } from "../environment.ts";
import { clock, type Output } from "../common.ts";
import { call } from "../http.ts";
import { ACACIA } from "../legacy/database.ts";
import { reconcile } from "../migration.ts";
import { prepareMorada, RULES_V2 } from "./parallel.ts";

const ACACIA_PROPERTIES = ["P0101", "P0102", "P0103"];
const ALL = [...ACACIA_PROPERTIES, "P0207"];

export async function decommission(out: Output): Promise<void> {
  const env = await setUp();
  await prepareMorada(env, RULES_V2); // the parallel run is over
  const { proxy, legacy } = env;

  // The reconciliation is done at the cutover: after it, Morada is the truth for
  // Acacia Grove
  const rows = await reconcile(legacy, env.morada, ACACIA, "2026-10");
  const balanced = rows.every((r) => r.legacy === r.morada + r.quarantine);

  // The proxy's new rules: a configuration change, which rolls back the same way
  proxy.rules.push({ route: "GET form1099", target: "off" });
  for (const route of ["GET apts", "GET assessments", "GET delinquents", "POST pay"])
    proxy.rules.push({ route, properties: ACACIA_PROPERTIES, target: "morada" });
  proxy.rules.push({
    route: "POST notices",
    properties: ACACIA_PROPERTIES,
    target: "morada",
  });
  // In the legacy, Acacia Grove's properties become read-only: a forgotten write
  // fails loudly, instead of writing where nobody reads anymore
  legacy.exec("UPDATE property SET read_only = 'Y' WHERE ein = '" + ACACIA + "'");

  out.write(`${clock.today}: Acacia Grove on Morada; form1099 turned off`);
  const report = await call(env.url, "GET", "/reports/form1099?year=2025");
  const { error } = report.body as { error: string };
  out.write(`  the old app asks for form1099: ${report.status} ${error}`);
  await useApp(env.url, ALL, 30, 21);

  out.write(`${clock.today}: 30 days later, calls by target`);
  const sum = (filter: (k: string[]) => boolean) =>
    [...proxy.calls]
      .filter(([k]) => filter(k.split("|")))
      .reduce((s, [, n]) => s + n, 0);
  const ofAcacia = (k: string[]) => ACACIA_PROPERTIES.includes(k[2]);
  const to = (target: string) => sum((k) => ofAcacia(k) && k[1] === target);
  out.write(`  Acacia Grove -> Morada: ${to("morada")}`);
  out.write(`  Acacia Grove -> legacy: ${to("legacy")}`);
  out.write(`  Ironwood Place -> legacy: ${sum((k) => k[2] === "P0207")}`);

  out.write();
  out.write("checklist to turn off Acacia Grove in the legacy:");
  const noTraffic = sum((k) => ofAcacia(k) && k[1] !== "morada") === 0;
  out.write(
    `  [${noTraffic ? "x" : " "}] no calls from Acacia Grove to the legacy in 30 days`,
  );
  out.write(`  [${balanced ? "x" : " "}] reconciliation passed on cutover day`);
  const { rows: q } = await env.morada.query<{ n: number }>(
    "SELECT count(*)::int n FROM acl.quarantine",
  );
  out.write(`  [${q[0].n === 0 ? "x" : " "}] quarantine empty`);

  // The archive: everything the legacy had for Acacia Grove, in a JSON file with its
  // hash recorded
  const properties = "property IN ('P0101','P0102','P0103')";
  const archive: Record<string, unknown[]> = {};
  for (const t of ["apt", "assessment", "notice"])
    archive[t] = legacy
      .prepare(`SELECT * FROM ${t} WHERE ${properties} ORDER BY 1, 2`)
      .all();
  const json = JSON.stringify(archive);
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 16);
  const nRows = Object.values(archive).reduce((s, l) => s + l.length, 0);
  out.write(`  [x] archive exported: ${nRows} rows, sha256 ${hash}`);

  out.write();
  out.write("turning off Acacia Grove in the legacy:");
  for (const t of ["assessment", "apt", "notice"]) {
    const r = legacy.prepare(`DELETE FROM ${t} WHERE ${properties}`).run();
    out.write(`  ${t}: ${r.changes} rows deleted`);
  }
  legacy.exec("DELETE FROM property WHERE ein = '" + ACACIA + "'");
  // The proof: even if someone brings the proxy rule back, the legacy no longer has
  // Acacia Grove
  proxy.rules = proxy.rules.filter((r) => !r.properties);
  const back = await call(env.url, "GET", "/properties/P0101/apts");
  out.write(`  rule undone by mistake, the legacy answers: ${back.status}`);
  const left = legacy.prepare("SELECT count(*) n FROM apt").get() as { n: number };
  out.write(`  the legacy still has Ironwood Place: 1 property, ${left.n} apts`);
  await env.close();
}
