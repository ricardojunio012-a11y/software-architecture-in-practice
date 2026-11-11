// Step 1: the proxy goes in front of the legacy without changing anything and
// measures the use of each route. The inventory says what to migrate first and what
// to turn off without migrating.
import { setUp, useApp } from "../environment.ts";
import type { Output } from "../common.ts";

// The state each route reads or writes, surveyed in the legacy's code
const STATE: Record<string, string> = {
  "GET apts": "apt",
  "GET assessments": "assessment",
  "POST pay": "assessment",
  "GET delinquents": "assessment",
  "POST notices": "notice",
  "GET form1099": "assessment (annual report)",
};

export async function inventory(out: Output): Promise<void> {
  const env = await setUp();
  await useApp(env.url, ["P0101", "P0102", "P0103", "P0207"], 30, 7);
  out.write("30 days of use of Beta's app, measured at the proxy");
  const header = "route".padEnd(20) + "calls".padStart(10) + "properties".padStart(12);
  out.write(header + "  state");
  let total = 0;
  for (const route of Object.keys(STATE)) {
    let n = 0;
    const properties = new Set<string>();
    for (const [k, v] of env.proxy.calls)
      if (k.startsWith(route + "|")) {
        n += v;
        properties.add(k.split("|")[2]);
      }
    total += n;
    const col = (s: string | number, w: number) => String(s).padStart(w);
    out.write(
      `${route.padEnd(20)}${col(n, 10)}${col(properties.size, 12)}  ${STATE[route]}`,
    );
  }
  out.write(`total${String(total).padStart(25)}`);
  out.write();
  out.write("slices by the state each route touches:");
  out.write("  notices: state of its own, can move to Morada by itself");
  out.write("  apts, assessments, pay, delinquents: the same state; they move");
  out.write("    together, per customer, after the customer's data is migrated");
  out.write("  form1099: no calls in 30 days; a candidate to turn off without");
  out.write("    migrating");
  await env.close();
}
