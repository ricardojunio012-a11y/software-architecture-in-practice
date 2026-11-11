// The database of Beta's system, the competitor Morada bought. It is an in-memory
// SQLite with the schema and the habits of a 2009 system: each tower is a "property",
// a parking space is an "apt", and dates, amounts and shares are text. Amounts carry
// a thousands comma ("1,048.72") and dates put the day first ("10/11/2026" is
// November 10), the way the system's original vendor wrote them.
import { DatabaseSync } from "node:sqlite";
import { generator } from "../common.ts";

export const ACACIA = "12-3456789";
export const IRONWOOD = "98-7654321";
export const SCHEMA = `
  CREATE TABLE property (code TEXT PRIMARY KEY, name TEXT, ein TEXT,
                         read_only TEXT DEFAULT 'N');
  CREATE TABLE apt (property TEXT, apt TEXT, type TEXT, share TEXT,
                    owner TEXT, link TEXT, notes TEXT,
                    PRIMARY KEY (property, apt));
  CREATE TABLE budget (ein TEXT, period TEXT, amount TEXT);
  CREATE TABLE assessment (property TEXT, apt TEXT, period TEXT, due TEXT,
                           amount TEXT, paid TEXT, pay_date TEXT,
                           PRIMARY KEY (property, apt, period));
  CREATE TABLE notice (id INTEGER PRIMARY KEY, property TEXT, title TEXT);
`;

// Amounts and shares as text, the way the legacy stores them: "1,048.72", "0.036496"
export const toText = (cents: number) =>
  (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+\.)/g, ",");
export const fromText = (t: string) => Number(t.replace(/,/g, ""));

const NAMES = ["Anna", "Brian", "Carol", "David", "Ellen", "Frank", "Grace", "Henry"];

export function createLegacy(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  const property = db.prepare(
    "INSERT INTO property (code, name, ein) VALUES (?, ?, ?)",
  );
  property.run("P0101", "ACACIA GROVE TOWER A", ACACIA);
  property.run("P0102", "ACACIA GROVE TOWER B", ACACIA);
  property.run("P0103", "ACACIA GROVE TOWER C", ACACIA);
  property.run("P0207", "IRONWOOD PLACE", IRONWOOD);

  // Weight of each apt: ending 01 = 1.0; ending 02 = 1.2; parking space = 0.1
  const apts: [string, string, string, number, string, string][] = [];
  for (const code of ["P0101", "P0102", "P0103"])
    for (let floor = 1; floor <= 4; floor++)
      for (const end of ["01", "02"])
        apts.push([code, `0${floor}${end}`, "A", end === "01" ? 1 : 1.2, "", ""]);
  // The whole community's garage was registered under tower A
  const links = ["P0101/0102", "P0101/0301", "P0102/0101", "P0102/0202"];
  links.push("P0102/0401", "P0103/0102", "P0103/0201", "P0103/0302", "", "");
  links.forEach((l, i) =>
    apts.push(["P0101", `G-${String(i + 1).padStart(2, "0")}`, "G", 0.1, l, ""]),
  );
  for (let floor = 1; floor <= 6; floor++)
    for (const end of ["01", "02"])
      apts.push(["P0207", `0${floor}${end}`, "A", end === "01" ? 1 : 1.2, "", ""]);
  apts[0][5] = "BOARD PRES - DUES EXEMPT"; // P0101/0101
  apts[13][5] = "CALL AFTER 6PM"; // P0102/0302

  const insert = db.prepare("INSERT INTO apt VALUES (?, ?, ?, ?, ?, ?, ?)");
  const einOf = (code: string) => (code === "P0207" ? IRONWOOD : ACACIA);
  const total = (ein: string) =>
    apts.filter((a) => einOf(a[0]) === ein).reduce((s, a) => s + a[3], 0);
  apts.forEach(([code, apt, type, weight, link, notes], i) => {
    const share = (weight / total(einOf(code))).toFixed(6);
    insert.run(code, apt, type, share, NAMES[i % 8], link, notes);
  });

  const budget = db.prepare("INSERT INTO budget VALUES (?, ?, ?)");
  for (const period of ["08/2026", "09/2026", "10/2026", "11/2026"]) {
    budget.run(ACACIA, period, "28,735.40");
    budget.run(IRONWOOD, period, "9,876.50");
  }

  // The three closed months, with payments drawn with a fixed seed
  const draw = generator(41);
  for (const period of ["08/2026", "09/2026", "10/2026"]) {
    computeAssessments(db, ACACIA, period);
    computeAssessments(db, IRONWOOD, period);
    const rows = db.prepare("SELECT property, apt FROM assessment WHERE period = ?");
    const pay = db.prepare(
      "UPDATE assessment SET paid = 'Y', pay_date = ? WHERE property = ? AND apt = ? " +
        "AND period = ? AND amount <> '0.00'",
    );
    for (const r of rows.all(period) as { property: string; apt: string }[]) {
      if (draw() < 0.85) {
        const day = String(3 + Math.floor(draw() * 10)).padStart(2, "0");
        pay.run(`${day}/${period}`, r.property, r.apt, period);
      }
    }
  }
  return db;
}

// The legacy's assessment calculation, translated from the original routine. Note
// the exemption rule: it is not in a field of its own, but in the free-text notes.
export function computeAssessments(
  db: DatabaseSync,
  ein: string,
  period: string,
): void {
  const budget = db
    .prepare("SELECT amount FROM budget WHERE ein = ? AND period = ?")
    .get(ein, period) as { amount: string };
  const apts = db
    .prepare(
      "SELECT a.* FROM apt a JOIN property p ON p.code = a.property WHERE p.ein = ?",
    )
    .all(ein) as { property: string; apt: string; share: string; notes: string }[];
  const insert = db.prepare("INSERT INTO assessment VALUES (?, ?, ?, ?, ?, 'N', '')");
  for (const a of apts) {
    let cents = Math.trunc(fromText(budget.amount) * fromText(a.share) * 100);
    if (a.notes.toUpperCase().includes("BOARD PRES")) cents = 0;
    insert.run(a.property, a.apt, period, `10/${period}`, toText(cents));
  }
}
