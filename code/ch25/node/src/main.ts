// The "queue" and "pressure" versions. In both, the monthly generation enqueues one
// task per community, and 16 workers consume it.
//  queue:    a worker dies holding a task; it goes back to the queue and is redone,
//            without duplicating invoices. Another worker stalls on task 200 and
//            tries to complete it after it has been redone: the ownership token
//            blocks it.
//  pressure: in the middle of the generation, 50 more urgent invoice reissue requests
//            arrive; and the payment processor accepts only 8 concurrent calls,
//            first without and then with backpressure on the workers' side.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { PaymentProcessor, Rejected, Semaphore } from "./processor.ts";
import { claim, complete, type Task } from "./queue.ts";

const [data, version] = process.argv.slice(2);
const PERIOD = "2026-11";
const WORKERS = 16;
const connect = async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
};
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const fmt = (n: number) => n.toLocaleString("en-US");

async function prepare() {
  const db = await connect();
  await db.query(fs.readFileSync(path.join(data, "sql", "schema.sql"), "utf8"));
  await db.query(
    "INSERT INTO tasks (kind, community_id, priority) " +
      "SELECT 'monthly', id, 10 FROM communities ORDER BY id",
  );
  return db;
}

async function run(
  processor: PaymentProcessor,
  semaphore: Semaphore | null,
  dies: boolean,
) {
  const watcher = await connect();
  let reissues = false;
  let slowBlocked = false;
  const work = async () => {
    const db = await connect();
    for (;;) {
      const task = await claim(db);
      if (!task) {
        // The queue may be empty for just an instant: check whether work remains
        const { rows } = await db.query(
          "SELECT count(*)::integer AS n FROM tasks WHERE status <> 'done'",
        );
        if (rows[0].n === 0) break;
        await wait(100);
        continue;
      }
      // Whoever claims task 100 for the first time dies holding it, without
      // completing or releasing it
      if (dies && task.id === 100 && task.attempts === 1) {
        await db.end();
        return;
      }
      // Whoever claims task 200 for the first time stalls (a long pause, a slow
      // network) until another worker redoes it, and only then tries to complete it
      if (dies && task.id === 200 && task.attempts === 1) {
        await waitUntilDone(db, 200);
        slowBlocked = !(await complete(db, task, PERIOD));
        continue;
      }
      await createWithRetries(processor, semaphore);
      await complete(db, task as Task, PERIOD);
    }
    await db.end();
  };
  const workers = Array.from({ length: WORKERS }, () => work());
  // In the middle of the generation, 50 invoice reissue requests arrive, with higher
  // priority
  if (!dies) {
    for (;;) {
      const { rows } = await watcher.query(
        "SELECT count(*)::integer AS n FROM tasks WHERE status = 'done'",
      );
      if (rows[0].n >= 1500) break;
      await wait(20);
    }
    await watcher.query(
      "INSERT INTO tasks (kind, community_id, priority) " +
        "SELECT 'reissue', id, 1 FROM communities WHERE id <= 50",
    );
    reissues = true;
  }
  await Promise.all(workers);
  await watcher.end();
  return { reissues, slowBlocked };
}

async function waitUntilDone(db: pg.Client, id: number) {
  for (;;) {
    const { rows } = await db.query("SELECT status FROM tasks WHERE id = $1", [id]);
    if (rows[0].status === "done") return;
    await wait(100);
  }
}

async function createWithRetries(
  processor: PaymentProcessor,
  semaphore: Semaphore | null,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      const call = () => processor.createInvoice();
      return await (semaphore ? semaphore.use(call) : call());
    } catch (error) {
      if (!(error instanceof Rejected)) throw error;
      await wait(10 * 2 ** Math.min(attempt, 5));
    }
  }
}

async function summary(db: pg.Client) {
  const q = async (sql: string) => (await db.query(sql)).rows[0];
  const t = await q(
    "SELECT count(*) FILTER (WHERE status = 'done')::integer AS done, " +
      "count(*) FILTER (WHERE attempts > 1)::integer AS redone FROM tasks",
  );
  const i = await q("SELECT count(*)::integer AS n FROM invoices");
  const expected = await q("SELECT sum(units)::integer AS n FROM communities");
  return { ...t, invoices: i.n, expected: expected.n };
}

const lines: string[] = [];
if (version === "queue") {
  const db = await prepare();
  const { slowBlocked } = await run(new PaymentProcessor(1000), null, true);
  const r = await summary(db);
  lines.push(
    `3,000 communities enqueued, ${WORKERS} workers`,
    "a worker died holding task 100",
    "a slow worker tried to complete task 200, already redone: " +
      (slowBlocked ? "blocked (ownership token)" : "succeeded"),
    `tasks done: ${fmt(r.done)}; ` +
      `redone after the visibility timeout: ${fmt(r.redone)}`,
    `invoices created: ${fmt(r.invoices)} (expected: ${fmt(r.expected)})`,
  );
  await db.end();
} else {
  for (const withBackpressure of [false, true]) {
    const db = await prepare();
    const processor = new PaymentProcessor(8);
    await run(processor, withBackpressure ? new Semaphore(8) : null, false);
    const { rows } = await db.query(
      `SELECT max(finished_at) FILTER (WHERE kind = 'reissue') <
              max(finished_at) FILTER (WHERE kind = 'monthly') AS earlier
       FROM tasks`,
    );
    const r = await summary(db);
    lines.push(
      `== ${withBackpressure ? "with" : "without"} backpressure in the workers`,
      `tasks done: ${fmt(r.done)} (3,000 monthly + 50 reissues)`,
      "the reissues finished before the monthly tasks: " +
        (rows[0].earlier ? "yes" : "no"),
      `payment processor rejections: ${processor.rejections > 0 ? "some" : "none"}`,
      "",
    );
    await db.end();
  }
}

const output = path.join(data, "output", version);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
