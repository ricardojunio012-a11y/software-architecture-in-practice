// Step 4: parallel run. The legacy keeps answering the app; Morada receives the same
// requests for Acacia Grove through the compatibility layer, and the proxy compares
// the answers. After fixing what showed up, a second round.
import { RULES_V1, type Rules } from "../acl/beta.ts";
import { setUp, useApp, type Environment } from "../environment.ts";
import type { Output } from "../common.ts";
import { ACACIA } from "../legacy/database.ts";
import { migrate } from "../migration.ts";
import { computeCharges } from "../morada/database.ts";
import type { BetaProxy } from "../proxy.ts";

const ACACIA_PROPERTIES = ["P0101", "P0102", "P0103"];

// The second version of the rules: the board president's exemption, found in the
// first round, and the link of the two parking spaces, given by Acacia Grove's board
export const RULES_V2: Rules = {
  exemptionFromNotes: true,
  links: { "P0101/G-09": "P0103/0402", "P0101/G-10": "P0102/0101" },
};

export async function prepareMorada(env: Environment, rules: Rules): Promise<void> {
  await migrate(env.legacy, env.morada, ACACIA, "2026-10", rules);
  await computeCharges(env.morada, "c12345678", "2026-11");
}

const items = (n: number) => (n === 1 ? "1 item" : `${n} items`);
const times = (n: number) => (n === 1 ? "1 time" : `${n} times`);

function report(out: Output, p: BetaProxy): void {
  out.write(`  requests compared: ${p.comparisons}; matching: ${p.matches}`);
  const byKind = new Map<string, Set<string>>();
  const occurrences = new Map<string, number>();
  for (const d of p.divergences) {
    const kind = `${d.kind} (${d.route})`;
    byKind.set(kind, (byKind.get(kind) ?? new Set()).add(d.key));
    occurrences.set(kind, (occurrences.get(kind) ?? 0) + 1);
  }
  for (const [kind, keys] of [...byKind].sort()) {
    const list = [...keys].sort();
    const sample = list.slice(0, 3).join(", ") + (list.length > 3 ? ", ..." : "");
    out.write(`  ${kind}: ${items(list.length)}, ${times(occurrences.get(kind)!)}`);
    out.write(`    ${sample}`);
  }
  const serious = p.divergences.filter((d) => !d.kind.includes("(accepted)"));
  const n = new Set(serious.map((d) => d.key)).size;
  out.write(`  unexplained: ${items(n)}, ${times(serious.length)}`);
}

export async function parallel(out: Output): Promise<void> {
  const env = await setUp();
  await prepareMorada(env, RULES_V1);
  for (const route of ["GET apts", "GET assessments", "GET delinquents", "POST pay"])
    env.proxy.rules.push({ route, properties: ACACIA_PROPERTIES, target: "shadow" });

  out.write("round 1: 10 days, Acacia Grove in shadow mode, layer rules v1");
  await useApp(env.url, ACACIA_PROPERTIES, 10, 11);
  report(out, env.proxy);

  out.write();
  out.write("fixes: board president's exemption from the notes; G-09 and G-10 linked");
  await prepareMorada(env, RULES_V2);
  env.proxy.comparisons = env.proxy.matches = 0;
  env.proxy.divergences = [];

  out.write();
  out.write("round 2: 10 more days, layer rules v2");
  await useApp(env.url, ACACIA_PROPERTIES, 10, 12);
  report(out, env.proxy);
  await env.close();
}
