// The "leak" version: the board president of community 12 opens the delinquency
// report, first without RLS and then with RLS. Then management company 3, which
// manages communities 12 and 15, opens the same report. The faulty query is the same
// in every case.
import fs from "node:fs";
import path from "node:path";
import { asCommunity, asManagementCompany, connect } from "./db.ts";
import { delinquents, type Delinquent } from "./report.ts";

const data = process.argv[2];
const sql = (file: string) => fs.readFileSync(path.join(data, "sql", file), "utf8");
const admin = await connect(process.env.DATABASE_URL!);
await admin.query(sql("schema.sql"));
const app = await connect(process.env.APP_DATABASE_URL!);
const BOARD_PRESIDENT = 12;
const MANAGEMENT_COMPANY = 3; // manages communities 12 and 15
const REJECTED_BY_POLICY = "42501";

const dollars = (cents: number) =>
  "$" +
  (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const log: string[] = [];
let step = 0;
function show(title: string, rows: Delinquent[], allowed = [BOARD_PRESIDENT]) {
  log.push(`${++step}. ${title}`);
  for (const r of rows) {
    const warning = allowed.includes(r.community_id) ? "" : "  <- another community";
    log.push(
      `   community ${r.community_id} | unit ${r.unit} | ${r.resident} | ` +
        `${dollars(r.amount_cents)}${warning}`,
    );
  }
  if (rows.length === 0) log.push("   no rows");
  const leaked = rows.filter((r) => !allowed.includes(r.community_id)).length;
  log.push(`   rows from other communities: ${leaked}`, "");
}

show(
  "board president's report for community 12, without RLS",
  await asCommunity(app, BOARD_PRESIDENT, () => delinquents(app)),
);
await admin.query(sql("rls.sql"));
show(
  "the same report, with RLS",
  await asCommunity(app, BOARD_PRESIDENT, () => delinquents(app)),
);
show(
  "with RLS, in a transaction with no community set",
  await asCommunity(app, null, () => delinquents(app)),
);

log.push(`${++step}. with RLS, community 12 tries to write a charge for community 15`);
try {
  await asCommunity(app, BOARD_PRESIDENT, () =>
    app.query(
      "INSERT INTO charges " +
        "(community_id, unit, resident, amount_cents, status) " +
        "VALUES (15, '13', 'Hugh Davis', 38000, 'open')",
    ),
  );
  log.push("   written");
} catch (error) {
  if ((error as { code?: string }).code !== REJECTED_BY_POLICY) throw error;
  log.push("   rejected by the database: the row fails the RLS policy");
}

show(
  "with RLS, management company 3, which manages communities 12 and 15",
  await asManagementCompany(app, MANAGEMENT_COMPANY, () => delinquents(app)),
  [12, 15],
);
log.push(
  `${++step}. with RLS, management company 3 tries to write a charge for community 20`,
);
try {
  await asManagementCompany(app, MANAGEMENT_COMPANY, () =>
    app.query(
      "INSERT INTO charges " +
        "(community_id, unit, resident, amount_cents, status) " +
        "VALUES (20, 'A-5', 'Hugh Davis', 61000, 'open')",
    ),
  );
  log.push("   written");
} catch (error) {
  if ((error as { code?: string }).code !== REJECTED_BY_POLICY) throw error;
  log.push("   rejected by the database: the row fails every policy");
}
await Promise.all([admin.end(), app.end()]);

const output = path.join(data, "output", "leak");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "report.txt"), log.join("\n") + "\n");
console.log("leak: six steps run");
