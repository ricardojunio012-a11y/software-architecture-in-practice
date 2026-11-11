// Step 3: migrate Acacia Grove's data to Morada and reconcile. First the naive copy,
// then through the anticorruption layer, and then again, to see that repeating the
// migration does not duplicate anything.
import { RULES_V1 } from "../acl/beta.ts";
import type { Output } from "../common.ts";
import { ACACIA, createLegacy } from "../legacy/database.ts";
import { migrate, migrateNaive, reconcile, type Row } from "../migration.ts";
import { createMorada } from "../morada/database.ts";

function show(out: Output, rows: Row[]): void {
  out.write("  item                                      legacy   Morada  quarant.");
  let errors = 0;
  for (const r of rows) {
    const ok = r.legacy === r.morada + r.quarantine;
    if (!ok) errors++;
    const n = (x: number) => String(x).padStart(9);
    out.write(
      `  ${r.item.padEnd(40)}${n(r.legacy)}${n(r.morada)}${n(r.quarantine)}` +
        `  ${ok ? "ok" : "DIFFERENT"}`,
    );
  }
  const items = errors === 1 ? "1 item" : `${errors} items`;
  const verdict = errors === 0 ? "passed" : `${items} with a difference`;
  out.write(`  reconciliation: ${verdict}`);
}

export async function migration(out: Output): Promise<void> {
  const legacy = createLegacy();
  const until = "2026-10";

  out.write("1. naive copy (parseFloat, new Date, parking space as a unit)");
  const naive = await createMorada();
  await migrateNaive(legacy, naive, ACACIA, until);
  show(out, await reconcile(legacy, naive, ACACIA, until));
  await naive.close();

  out.write();
  out.write("2. through the anticorruption layer");
  const morada = await createMorada();
  await migrate(legacy, morada, ACACIA, until, RULES_V1);
  show(out, await reconcile(legacy, morada, ACACIA, until));

  out.write();
  out.write("3. the same migration again (idempotent)");
  await migrate(legacy, morada, ACACIA, until, RULES_V1);
  show(out, await reconcile(legacy, morada, ACACIA, until));
  await morada.close();
}
