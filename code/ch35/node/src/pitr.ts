// Scenario "pitr": a table dropped by mistake and recovered up to the moment
// before the accident, on a separate instance, without losing what came after.
import { Report, connect } from "./common.ts";
import * as b from "./backup.ts";
import * as d from "./data.ts";

const root = process.argv[2];
const report = new Report(root, "pitr");
const url = process.env.DATABASE_URL!;
const db = await connect(url);

report.say("Morada: point-in-time recovery (PITR)");
report.say();
await d.prepare(db);
report.say("1. Before the backup");
report.say(`   charges: ${await d.signature(db)}`);

b.baseBackup("/copies/base");
report.say("2. Base backup with pg_basebackup; from here on, only the WAL is copied");

await d.pay(db, 400);
await d.publishNotices(db, 20);
const before = await d.signature(db);
report.say("3. The day goes on: 400 payments and 20 notices after the backup");
report.say(`   charges: ${before}`);

// The accident. The moment comes from the server clock, as it would come from the
// audit log or from pg_waldump in a real investigation
const { rows } = await db.query(
  "SELECT to_char(clock_timestamp(), 'YYYY-MM-DD HH24:MI:SS.US') AS t",
);
const moment = `${rows[0].t}+00`;
await db.query("DROP TABLE billing.charges");
report.say("4. By mistake, DROP TABLE billing.charges in production");
await d.publishNotices(db, 15);
report.say("   the rest of Morada stays up: 15 notices published afterward");
try {
  await d.countPaid(db);
} catch (error) {
  const code = (error as { code?: string }).code;
  report.say(`   the charges screen fails: error ${code} (the table does not exist)`);
}

report.resetClock(); // the RTO counts from the discovery
await b.closeSegment(db);
report.say("5. Restore on a separate instance, up to the moment before the DROP");
report.say("   the open WAL segment is closed and archived");
report.mark("WAL segment archived");
const restored = await b.restore("/copies/base", "/tmp/restore", moment);
report.mark("instance restored and promoted");
const recovered = await d.signature(restored);
report.say(`   restored charges: ${recovered}`);
report.say(`   same as before the accident: ${recovered === before ? "yes" : "NO"}`);
const restoredNotices = await d.countNotices(restored);
const productionNotices = await d.countNotices(db);
report.say(
  `   notices on the restored instance: ${restoredNotices}; in production: ` +
    `${productionNotices}`,
);
report.say(
  `   rolling the whole database back would lose ` +
    `${productionNotices - restoredNotices} notices`,
);
await restored.end();

b.copyTable("billing.charges", url);
report.mark("table copied back to production");
b.stopRestored("/tmp/restore");
const after = await d.signature(db);
report.say("6. Only the table goes back to production, with pg_dump and psql");
report.say(`   charges in production: ${after}`);
report.say(`   notices in production: ${await d.countNotices(db)}`);
const lost = 400 - (await d.countPaid(db));
report.say(`   payments lost (RPO): ${lost}`);
report.say();
report.say("The time of each stage (the measured RTO) is in output/timings/pitr.txt.");
report.save();
await db.end();
