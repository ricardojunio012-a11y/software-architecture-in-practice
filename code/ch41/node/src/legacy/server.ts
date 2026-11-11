// The API of Beta's legacy, which the board presidents' and residents' app uses.
// The contract (routes, names and formats) cannot change while old copies of the
// app are still out there.
import type { DatabaseSync } from "node:sqlite";
import { clock } from "../common.ts";
import { parts, type Response } from "../http.ts";
import { fromText, toText } from "./database.ts";

type Assessment = { apt: string; period: string; due: string; amount: string };
type Row = Assessment & { paid: string; pay_date: string };

// "10/11/2026" becomes "2026-11-10", to compare with today's date
const iso = (d: string) => d.split("/").reverse().join("-");

export function legacyApi(db: DatabaseSync) {
  return async (method: string, path: string, body: unknown): Promise<Response> => {
    const { seg, q } = parts(path);
    if (seg[0] === "reports" && seg[1] === "form1099")
      return { status: 200, body: { file: "F1099_2025.TXT", lines: 0 } };
    if (seg[0] !== "properties") return { status: 404, body: { error: "ROUTE" } };
    const code = seg[1];
    const property = db.prepare("SELECT * FROM property WHERE code = ?").get(code) as
      { read_only: string } | undefined;
    if (!property) return { status: 404, body: { error: "PROPERTY NOT FOUND" } };
    const route = `${method} ${seg[2]}`;

    if (route === "GET apts") {
      const sql = "SELECT apt, type, share FROM apt WHERE property = ?";
      return { status: 200, body: db.prepare(sql + " ORDER BY apt").all(code) };
    }
    if (route === "GET assessments") {
      const sql = "SELECT apt, period, due, amount, paid, pay_date FROM assessment";
      const rows = db
        .prepare(sql + " WHERE property = ? AND period = ? ORDER BY apt")
        .all(code, q.get("period"));
      return { status: 200, body: rows };
    }
    if (route === "GET delinquents") {
      const rows = db
        .prepare(
          "SELECT * FROM assessment WHERE property = ? AND paid = 'N' ORDER BY apt",
        )
        .all(code) as Row[];
      const overdue = rows.filter(
        (r) => iso(r.due) < clock.today && r.amount !== "0.00",
      );
      const perApt = new Map<string, { periods: string[]; cents: number }>();
      for (const r of overdue) {
        const a = perApt.get(r.apt) ?? { periods: [], cents: 0 };
        a.periods.push(r.period);
        a.cents += Math.round(fromText(r.amount) * 100);
        perApt.set(r.apt, a);
      }
      const body = [...perApt].map(([apt, a]) => ({
        apt,
        periods: a.periods.sort(),
        total: toText(a.cents),
      }));
      return { status: 200, body };
    }
    if (method === "POST" && property.read_only === "Y")
      return { status: 423, body: { ok: "N", error: "PROPERTY MIGRATED" } };
    if (route === "POST assessments" && seg[4] === "pay") {
      const { period, pay_date } = body as { period: string; pay_date: string };
      const r = db
        .prepare(
          "UPDATE assessment SET paid = 'Y', pay_date = ? WHERE property = ? " +
            "AND apt = ? AND period = ? AND paid = 'N'",
        )
        .run(pay_date, code, seg[3], period);
      if (r.changes === 0)
        return { status: 409, body: { ok: "N", error: "ALREADY PAID" } };
      return { status: 200, body: { ok: "Y" } };
    }
    if (route === "POST notices") {
      const { title } = body as { title: string };
      const r = db
        .prepare("INSERT INTO notice (property, title) VALUES (?, ?)")
        .run(code, title);
      return { status: 200, body: { ok: "Y", id: Number(r.lastInsertRowid) } };
    }
    return { status: 404, body: { error: "ROUTE" } };
  };
}
