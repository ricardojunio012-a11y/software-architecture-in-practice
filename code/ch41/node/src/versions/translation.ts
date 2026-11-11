// Step 2: the anticorruption layer translates Acacia Grove from Beta's model to
// Morada's, and sets apart what it does not know how to translate.
import { readLegacy, RULES_V1, translate } from "../acl/beta.ts";
import { dollars, type Output } from "../common.ts";
import { ACACIA, createLegacy } from "../legacy/database.ts";

export async function translation(out: Output): Promise<void> {
  const legacy = readLegacy(createLegacy(), ACACIA, "2026-10");
  const t = translate(legacy, RULES_V1);
  const type = (x: string) => legacy.apts.filter((a) => a.type === x).length;

  out.write(`legacy: ${legacy.properties.length} properties with EIN ${ACACIA}`);
  out.write(`  ${legacy.properties.map((p) => `${p.code} ${p.name}`).join("; ")}`);
  out.write(`  ${type("A")} apts of type A, ${type("G")} of type G (parking spaces)`);
  out.write(`  ${legacy.assessments.length} assessments from 08/2026 to 10/2026`);
  out.write();
  out.write(`Morada: 1 community, ${t.community.id} ("${t.community.name}")`);
  for (const b of ["A", "B", "C"]) {
    const n = t.units.filter((u) => u.building === b).length;
    out.write(`  building ${b}: ${n} units`);
  }
  out.write(`  ${t.spaces.length} parking spaces, each linked to a unit`);
  out.write(`  ${t.charges.length} charges`);
  out.write(`  quarantine: ${t.quarantine.length}`);
  for (const q of t.quarantine) out.write(`    ${q.legacy_key}: ${q.reason}`);
  out.write();

  out.write("examples, before and after:");
  const apt = legacy.apts.find((a) => a.property === "P0102" && a.apt === "0201")!;
  const u = t.units.find((u) => u.id.endsWith("-B-0201"))!;
  out.write(`  apt ${apt.property}/${apt.apt} type ${apt.type} share ${apt.share}`);
  out.write(`    -> unit ${u.id}, building ${u.building}, share ${u.share}`);
  const g = legacy.apts.find((a) => a.apt === "G-03")!;
  const s = t.spaces.find((s) => s.id.endsWith("G-03"))!;
  out.write(`  apt ${g.property}/${g.apt} type ${g.type} link ${g.link}`);
  out.write(`    -> parking space ${s.id} of unit ${s.unit_id}`);
  const a = legacy.assessments.find((a) => a.apt === "0102" && a.period === "10/2026")!;
  const c = t.charges.find((c) => c.id === "c12345678-A-0102.2026-10")!;
  out.write(
    `  assessment ${a.property}/${a.apt} ${a.period} ${a.due} ` +
      `${a.amount} paid ${a.paid} ${a.pay_date}`,
  );
  out.write(
    `    -> charge ${c.id}, ${c.due_date}, ` +
      `${dollars(c.amount_cents)}, paid on ${c.paid_on}`,
  );
}
