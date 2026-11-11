// Morada's API, in Morada's vocabulary: community, unit, charge, notice.
import type { PGlite } from "@electric-sql/pglite";
import { clock } from "../common.ts";
import { parts, type Response } from "../http.ts";

const CHARGE = `SELECT id, unit_id, item, period, due_date::text,
  amount_cents, paid_on::text FROM charges`;

export function moradaApi(db: PGlite) {
  return async (method: string, path: string, body: unknown): Promise<Response> => {
    const { seg, q } = parts(path);
    const route = `${method} ${seg[0]} ${seg[2] ?? ""}`.trim();
    const ok = (body: unknown) => ({ status: 200, body });

    if (route === "GET communities units") {
      const { rows } = await db.query(
        `SELECT u.id, u.building, u.number, u.share::text, u.exempt,
           coalesce(json_agg(json_build_object('id', s.id, 'share', s.share::text)
             ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), '[]') spaces
         FROM units u LEFT JOIN parking_spaces s ON s.unit_id = u.id
         WHERE u.community_id = $1 GROUP BY u.id ORDER BY u.id`,
        [seg[1]],
      );
      return ok(rows);
    }
    if (route === "GET communities charges") {
      const { rows } = await db.query(
        `${CHARGE} WHERE period = $2 AND unit_id IN
           (SELECT id FROM units WHERE community_id = $1) ORDER BY id`,
        [seg[1], q.get("period")],
      );
      return ok(rows);
    }
    if (route === "GET communities delinquency") {
      const { rows } = await db.query(
        `${CHARGE} WHERE paid_on IS NULL AND amount_cents > 0 AND due_date < $2
           AND unit_id IN (SELECT id FROM units WHERE community_id = $1)
         ORDER BY id`,
        [seg[1], clock.today],
      );
      return ok(rows);
    }
    if (route === "POST charges payment") {
      const { paid_on } = body as { paid_on: string };
      const r = await db.query(
        "UPDATE charges SET paid_on = $2 WHERE id = $1 AND paid_on IS NULL",
        [seg[1], paid_on],
      );
      if (r.affectedRows === 0) return { status: 409, body: { error: "already paid" } };
      return ok({ paid: true });
    }
    if (route === "POST communities notices") {
      const { title } = body as { title: string };
      const { rows } = await db.query<{ id: number }>(
        "INSERT INTO notices (community_id, title) VALUES ($1, $2) RETURNING id",
        [seg[1], title],
      );
      return ok({ id: rows[0].id });
    }
    return { status: 404, body: { error: "unknown route" } };
  };
}
