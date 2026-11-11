// The anticorruption layer between Beta and Morada. Only this file and compat.ts
// know both models. It translates vocabulary (property, apt, assessment), formats
// ("1,048.72", "10/11/2026" with the day first) and, above all, concepts: for Beta,
// each tower is a customer and a parking space is an apt; for Morada, the community
// is one, with buildings, and the parking space belongs to a unit.
import type { DatabaseSync } from "node:sqlite";

export type LegacyProperty = { code: string; name: string; ein: string };
export type LegacyApt = {
  property: string;
  apt: string;
  type: string;
  share: string;
  link: string;
  notes: string;
};
export type LegacyAssessment = {
  property: string;
  apt: string;
  period: string;
  due: string;
  amount: string;
  paid: string;
  pay_date: string;
};
export type Legacy = {
  properties: LegacyProperty[];
  apts: LegacyApt[];
  budgets: { period: string; amount: string }[];
  assessments: LegacyAssessment[];
};

export type Rules = {
  exemptionFromNotes: boolean; // the rule hidden in the free text (section 41.5)
  links: Record<string, string>; // unlinked parking spaces, decided by the board
};
export const RULES_V1: Rules = { exemptionFromNotes: false, links: {} };

export type Translation = {
  community: { id: string; name: string; ein: string };
  units: {
    id: string;
    building: string;
    number: string;
    share: string;
    exempt: boolean;
  }[];
  spaces: { id: string; unit_id: string; share: string }[];
  budgets: { period: string; amount_cents: number }[];
  charges: {
    id: string;
    unit_id: string;
    item: string;
    period: string;
    due_date: string;
    amount_cents: number;
    paid_on: string | null;
  }[];
  keyMap: { legacy_key: string; unit_id: string; item: string }[];
  quarantine: { legacy_key: string; reason: string }[];
};

// Formats: each conversion in one place only, refusing what it does not recognize
export function cents(amount: string): number {
  if (!/^\d{1,3}(,\d{3})*\.\d{2}$/.test(amount)) throw new Error(`amount: ${amount}`);
  return Number(amount.replace(/[,.]/g, ""));
}
export function isoDate(date: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!m) throw new Error(`date: ${date}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}
export function share(s: string): string {
  if (!/^0\.\d{6}$/.test(s)) throw new Error(`share: ${s}`);
  return s;
}
export const period = (p: string) => p.split("/").reverse().join("-");

export function readLegacy(db: DatabaseSync, ein: string, until: string): Legacy {
  const properties = db
    .prepare("SELECT code, name, ein FROM property WHERE ein = ? ORDER BY code")
    .all(ein) as LegacyProperty[];
  const codes = properties.map((p) => `'${p.code}'`).join(",");
  const apts = db
    .prepare(`SELECT * FROM apt WHERE property IN (${codes}) ORDER BY 1, 2`)
    .all() as LegacyApt[];
  const budgets = db
    .prepare("SELECT period, amount FROM budget WHERE ein = ? ORDER BY period")
    .all(ein) as { period: string; amount: string }[];
  const assessments = (
    db
      .prepare(`SELECT * FROM assessment WHERE property IN (${codes}) ORDER BY 1, 2, 3`)
      .all() as LegacyAssessment[]
  ).filter((a) => period(a.period) <= until);
  return { properties, apts, budgets, assessments };
}

export function translate(legacy: Legacy, rules: Rules): Translation {
  const p0 = legacy.properties[0];
  const id = "c" + p0.ein.replace(/\D/g, "").slice(0, 8);
  // "ACACIA GROVE TOWER A" becomes the community "ACACIA GROVE" with building "A"
  const name = p0.name.replace(/ TOWER \w+$/, "");
  const building = new Map(
    legacy.properties.map((p) => [p.code, /TOWER (\w+)$/.exec(p.name)?.[1] ?? "U"]),
  );
  const t: Translation = {
    community: { id, name, ein: p0.ein },
    units: [],
    spaces: [],
    budgets: legacy.budgets.map((b) => ({
      period: period(b.period),
      amount_cents: cents(b.amount),
    })),
    charges: [],
    keyMap: [],
    quarantine: [],
  };
  const unitOf = (key: string) => {
    const [code, apt] = key.split("/");
    return `${id}-${building.get(code)}-${apt}`;
  };

  for (const a of legacy.apts) {
    const key = `${a.property}/${a.apt}`;
    if (a.type === "A") {
      const exempt =
        rules.exemptionFromNotes && a.notes.toUpperCase().includes("BOARD PRES");
      const u = { id: unitOf(key), building: building.get(a.property)!, number: a.apt };
      t.units.push({ ...u, share: share(a.share), exempt });
      t.keyMap.push({ legacy_key: key, unit_id: u.id, item: "dues" });
    } else if (a.type === "G") {
      const link = a.link || rules.links[key];
      if (!link) {
        t.quarantine.push({ legacy_key: key, reason: "parking space with no unit" });
        continue;
      }
      const space = { id: `${id}-${a.apt}`, unit_id: unitOf(link) };
      t.spaces.push({ ...space, share: share(a.share) });
      t.keyMap.push({ legacy_key: key, unit_id: space.unit_id, item: space.id });
    } else {
      t.quarantine.push({ legacy_key: key, reason: `unknown type: ${a.type}` });
    }
  }

  const target = new Map(t.keyMap.map((k) => [k.legacy_key, k]));
  for (const a of legacy.assessments) {
    const k = target.get(`${a.property}/${a.apt}`);
    if (!k) continue; // the apt is in quarantine, and its assessment stays with it
    const p = period(a.period);
    t.charges.push({
      id: `${k.item === "dues" ? k.unit_id : k.item}.${p}`,
      unit_id: k.unit_id,
      item: k.item,
      period: p,
      due_date: isoDate(a.due),
      amount_cents: cents(a.amount),
      paid_on: a.paid === "Y" ? isoDate(a.pay_date) : null,
    });
  }
  return t;
}
