// The other direction of the anticorruption layer: it serves Beta's old contract
// with Morada's data. Beta's app keeps calling the same routes and receiving the
// same format, without knowing who answered (backward compatibility).
import type { PGlite } from "@electric-sql/pglite";
import { call, parts, type Response } from "../http.ts";

type Charge = {
  id: string;
  unit_id: string;
  item: string;
  period: string;
  due_date: string;
  amount_cents: number;
  paid_on: string | null;
};
type Unit = { id: string; share: string; spaces: { id: string; share: string }[] };

const text = (cents: number) =>
  (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+\.)/g, ",");
// The legacy's formats: day first in dates, month first in periods
const legacyDate = (iso: string) => iso.split("-").reverse().join("/");
const legacyPeriod = (p: string) => p.split("-").reverse().join("/");
const legacyShare = (s: string) => Number(s).toFixed(6);

export function compatBeta(morada: string, acl: PGlite) {
  // The key map: "P0101/G-03" <-> (unit, item) in Morada
  async function keys(code: string) {
    const { rows } = await acl.query<{
      legacy_key: string;
      unit_id: string;
      item: string;
    }>("SELECT * FROM acl.key_map WHERE legacy_key LIKE $1 ORDER BY 1", [code + "/%"]);
    const byItem = new Map(rows.map((r) => [`${r.unit_id}|${r.item}`, r.legacy_key]));
    const community = rows[0]?.unit_id.split("-")[0];
    return {
      rows,
      community,
      apt: (c: Charge) => byItem.get(`${c.unit_id}|${c.item}`),
    };
  }

  return async (method: string, path: string, body: unknown): Promise<Response> => {
    const { seg, q } = parts(path);
    const code = seg[1];
    const k = await keys(code);
    if (!k.community) return { status: 404, body: { error: "PROPERTY NOT FOUND" } };
    const route = `${method} ${seg[2]}`;
    const read = async <T>(p: string) => (await call(morada, "GET", p)).body as T;

    if (route === "GET apts") {
      const units = await read<Unit[]>(`/communities/${k.community}/units`);
      const shares = new Map<string, string>();
      for (const u of units) {
        shares.set(`${u.id}|dues`, u.share);
        for (const s of u.spaces) shares.set(`${u.id}|${s.id}`, s.share);
      }
      const body = k.rows.map((r) => ({
        apt: r.legacy_key.split("/")[1],
        type: r.item === "dues" ? "A" : "G",
        share: legacyShare(shares.get(`${r.unit_id}|${r.item}`)!),
      }));
      return { status: 200, body };
    }
    if (route === "GET assessments") {
      const period = q.get("period")!.split("/").reverse().join("-");
      const url = `/communities/${k.community}/charges?period=${period}`;
      const body = (await read<Charge[]>(url))
        .filter((c) => k.apt(c))
        .map((c) => ({
          apt: k.apt(c)!.split("/")[1],
          period: q.get("period"),
          due: legacyDate(c.due_date),
          amount: text(c.amount_cents),
          paid: c.paid_on ? "Y" : "N",
          pay_date: c.paid_on ? legacyDate(c.paid_on) : "",
        }))
        .sort((a, b) => (a.apt < b.apt ? -1 : 1));
      return { status: 200, body };
    }
    if (route === "GET delinquents") {
      const open = await read<Charge[]>(`/communities/${k.community}/delinquency`);
      const perApt = new Map<string, { periods: string[]; cents: number }>();
      for (const c of open.filter((c) => k.apt(c))) {
        const apt = k.apt(c)!.split("/")[1];
        const a = perApt.get(apt) ?? { periods: [], cents: 0 };
        a.periods.push(legacyPeriod(c.period));
        a.cents += c.amount_cents;
        perApt.set(apt, a);
      }
      const body = [...perApt]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([apt, a]) => ({ apt, periods: a.periods.sort(), total: text(a.cents) }));
      return { status: 200, body };
    }
    if (route === "POST assessments" && seg[4] === "pay") {
      const { period, pay_date } = body as { period: string; pay_date: string };
      const r = k.rows.find((r) => r.legacy_key === `${code}/${seg[3]}`);
      if (!r) return { status: 404, body: { ok: "N", error: "APT NOT FOUND" } };
      const target = r.item === "dues" ? r.unit_id : r.item;
      const id = `${target}.${period.split("/").reverse().join("-")}`;
      const paid_on = pay_date.split("/").reverse().join("-");
      const res = await call(morada, "POST", `/charges/${id}/payment`, { paid_on });
      if (res.status === 409)
        return { status: 409, body: { ok: "N", error: "ALREADY PAID" } };
      return { status: 200, body: { ok: "Y" } };
    }
    if (route === "POST notices") {
      const { title } = body as { title: string };
      const r = await call(morada, "POST", `/communities/${k.community}/notices`, {
        title,
      });
      return { status: 200, body: { ok: "Y", id: (r.body as { id: number }).id } };
    }
    return { status: 404, body: { error: "ROUTE" } };
  };
}
