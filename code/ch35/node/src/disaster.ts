// Scenario "disaster": the database server is lost. What is left is what was
// outside it: the base backup and the WAL segments already archived.
import { Report, connect } from "./common.ts";
import * as b from "./backup.ts";
import * as d from "./data.ts";

const root = process.argv[2];
const report = new Report(root, "disaster");
const db = await connect(process.env.DATABASE_URL!);

report.say("Morada: the database server is lost");
report.say();
await d.prepare(db);
b.baseBackup("/copies/base");
report.say(`1. Base backup: ${await d.signature(db)}`);

await d.pay(db, 300);
await b.closeSegment(db);
report.say("2. 300 payments; the WAL segment closes and goes to the archive");

await d.pay(db, 40);
const onPrimary = await d.countPaid(db);
report.say("3. 40 more payments, in the segment still open on the server");
report.say(`   paid charges on the primary: ${onPrimary}`);

// The primary is not used from here on: it is as if the disk had burned
report.resetClock();
report.say("4. The server is lost; restore from the base backup with all the");
report.say("   archived WAL, no target: recovery runs to the last segment");
const restored = await b.restore("/copies/base", "/tmp/restore");
report.mark("instance restored and promoted");
const recovered = await d.countPaid(restored);
report.say(`   paid charges on the restored database: ${recovered}`);
report.say(
  `   payments lost (RPO): ${onPrimary - recovered}, the ones in the segment ` +
    "that never reached the archive",
);
await restored.end();
b.stopRestored("/tmp/restore");
report.say();
report.say("With archive_timeout = 60, the segment would close every minute: the RPO");
report.say(
  'would be limited to about a minute of transactions, not "until 16 MB fill up".',
);
report.save();
await db.end();
