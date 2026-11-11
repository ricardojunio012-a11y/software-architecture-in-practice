// The "isolation" version: two reserve fund withdrawals, always interleaved in the
// same order, under three isolation levels. Each transaction checks the balance
// before recording its withdrawal, and even so the balance can go negative.
import fs from "node:fs";
import path from "node:path";
import type pg from "pg";
import { connect, resetSchema } from "./db.ts";
import { balance, dollars, insertWithdrawal, setUpFund } from "./fund.ts";
import { applyMigrations } from "./migrations.ts";

const data = process.argv[2];
const url = process.env.DATABASE_URL!;
const db = await connect(url);
await resetSchema(db);
await applyMigrations(db, path.join(data, "migrations"));

const log: string[] = [];
const SERIALIZATION_FAILURE = "40001";

// A whole withdrawal, with no interleaving: used on the retry
async function retry(t: pg.Client, level: string, amount: number, reason: string) {
  await t.query(`BEGIN ISOLATION LEVEL ${level}`);
  const read = await balance(t, 1);
  log.push(`T2 reads the balance: ${dollars(read)}`);
  if (read < amount) {
    log.push(`T2 refuses the withdrawal of ${dollars(amount)}: insufficient balance`);
    await t.query("ROLLBACK");
    return;
  }
  await insertWithdrawal(t, 1, amount, reason);
  await t.query("COMMIT");
  log.push(`T2 records a withdrawal of ${dollars(amount)} and commits`);
}

for (const level of ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]) {
  log.push(`== ${level}`);
  await setUpFund(db);
  const t1 = await connect(url);
  const t2 = await connect(url);
  await t1.query(`BEGIN ISOLATION LEVEL ${level}`);
  await t2.query(`BEGIN ISOLATION LEVEL ${level}`);
  log.push("T1 and T2 begin");
  const read1 = await balance(t1, 1);
  log.push(`T1 reads the balance: ${dollars(read1)}`);
  const read2 = await balance(t2, 1);
  log.push(`T2 reads the balance: ${dollars(read2)}`);
  if (read1 >= 70000) {
    await insertWithdrawal(t1, 1, 70000, "gate repair");
    log.push(`T1 records a withdrawal of ${dollars(70000)}`);
  }
  if (read2 >= 60000) {
    await insertWithdrawal(t2, 1, 60000, "facade painting");
    log.push(`T2 records a withdrawal of ${dollars(60000)}`);
  }
  await t1.query("COMMIT");
  log.push("T1 commits");
  try {
    await t2.query("COMMIT");
    log.push("T2 commits");
  } catch (error) {
    if ((error as { code?: string }).code !== SERIALIZATION_FAILURE) throw error;
    log.push("T2 cannot commit: serialization failure; it tries again");
    await t2.query("ROLLBACK");
    await retry(t2, level, 60000, "facade painting");
  }
  await t1.end();
  await t2.end();
  const final = await balance(db, 1);
  const warning = final < 0 ? " (negative: the rule was broken)" : "";
  log.push(`final balance: ${dollars(final)}${warning}`, "");
}
await db.end();

const output = path.join(data, "output", "isolation");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "run.txt"), log.join("\n"));
console.log("isolation: three levels run");
