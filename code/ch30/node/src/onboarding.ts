// The onboarding of Garden Court Condominiums: contract, first charge, tenant
// provisioning, resident import and, last, the welcome email.
//   naive         calls the services in sequence; the import fails, nothing is undone
//   saga          the same failure, with an orchestrator that compensates the completed
//                 steps
//   resume        the fixed spreadsheet; the orchestrator crashes midway and another
//                 one resumes
//   compensation  the spreadsheet with the error; the orchestrator crashes midway
//                 through compensation, and another one resumes compensating, without
//                 moving forward again
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { runSaga, type Step, Crash } from "./saga.ts";
import * as s from "./services.ts";

const [version, data] = process.argv.slice(2);
const connect = async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
};

// 40 residents with valid tax IDs; in the original spreadsheet, line 37 is missing the
// last digit
function taxId(base: number): string {
  const t = String(base).padStart(9, "0");
  return `${t.slice(0, 3)}-${t.slice(3, 5)}-${t.slice(5)}`;
}
const spreadsheet = (withError: boolean): s.Resident[] =>
  Array.from({ length: 40 }, (_, i) => {
    let id = taxId(123456000 + i * 7919);
    if (withError && i === 36) id = id.slice(0, -1);
    return { name: `Resident ${i + 1}`, taxId: id, unit: `${101 + i}` };
  });

const community = "Garden Court Condominiums";
const saga = "onboarding-garden-court";
let billingCalls = 0;
const steps = (db: pg.Client, residents: s.Resident[]): Step[] => [
  {
    name: "contract",
    run: () => s.signContract(db, saga, community),
    compensate: (reason) => s.cancelContract(db, saga, reason),
  },
  {
    name: "charge",
    run: () => {
      billingCalls++;
      return s.issueCharge(db, saga, community, 89000);
    },
    compensate: () => s.reverseCharge(db, saga),
  },
  {
    name: "provisioning",
    run: () => s.provisionTenant(db, saga, community),
    compensate: () => s.deactivateTenant(db, saga),
  },
  {
    name: "import",
    run: () => s.importResidents(db, saga, residents),
    compensate: () => s.removeResidents(db, saga),
  },
  {
    name: "welcome",
    run: () => s.sendWelcome(db, saga, community),
    pivot: true,
  },
];

async function finalState(db: pg.Client): Promise<string[]> {
  const one = async (sql: string) => (await db.query(sql, [saga])).rows[0];
  const contract = await one("SELECT status FROM contracts.contracts WHERE saga = $1");
  const { rows: ledger } = await db.query(
    "SELECT kind, amount_cents FROM billing.entries " +
      "WHERE key LIKE $1 || ':%' ORDER BY id",
    [saga],
  );
  const tenant = await one("SELECT status FROM platform.tenants WHERE saga = $1");
  const residents = await one(
    "SELECT count(*)::integer AS n FROM directory.residents WHERE saga = $1",
  );
  const notice = await one("SELECT recipients FROM notifications.sent WHERE key = $1");
  const dollars = (c: number) =>
    `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const entries = ledger.map((l) => `${l.kind} ${dollars(l.amount_cents)}`);
  return [
    `  contract:   ${contract?.status ?? "none"}`,
    `  entries:    ${entries.join("; ") || "none"}`,
    `  tenant:     ${tenant?.status ?? "none"}`,
    `  residents:  ${residents.n}`,
    `  welcome:    ${notice ? `sent to ${notice.recipients}` : "not sent"}`,
  ];
}

const db = await connect();
await db.query(fs.readFileSync(path.join(data, "sql", "schema.sql"), "utf8"));
const lines: string[] = [];

if (version === "naive") {
  try {
    for (const step of steps(db, spreadsheet(true))) await step.run();
  } catch (error) {
    lines.push(`failed: ${(error as Error).message}`);
  }
} else if (version === "saga") {
  lines.push(`saga ${await runSaga(db, saga, steps(db, spreadsheet(true)))}`);
} else if (version === "compensation") {
  try {
    const crash = "compensation:provisioning";
    await runSaga(db, saga, steps(db, spreadsheet(true)), crash);
  } catch (error) {
    if (!(error instanceof Crash)) throw error;
    lines.push(
      "the orchestrator crashed during compensation, after deactivating the tenant",
    );
  }
  // The process that resumes already sees the fixed spreadsheet, as if the failure had
  // been transient: moving forward now would complete the saga on top of undone steps
  const other = await connect(); // a new orchestrator process
  lines.push(`saga ${await runSaga(other, saga, steps(other, spreadsheet(false)))}`);
  await other.end();
} else {
  try {
    await runSaga(db, saga, steps(db, spreadsheet(false)), "charge");
  } catch (error) {
    if (!(error instanceof Crash)) throw error;
    lines.push("the orchestrator crashed after the charge, before saving its progress");
  }
  const other = await connect(); // a new orchestrator process
  lines.push(`saga ${await runSaga(other, saga, steps(other, spreadsheet(false)))}`);
  lines.push(`calls to the billing service: ${billingCalls}`);
  await other.end();
}

const { rows: history } = await db.query(
  "SELECT message FROM orchestrator.history ORDER BY id",
);
if (history.length > 0) {
  lines.push("orchestrator history:", ...history.map((h) => `  ${h.message}`));
}
lines.push("final state in the services:", ...(await finalState(db)));
await db.end();

const output = path.join(data, "output", version);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
