// Provisions the queue, the bucket, and the database of a Morada environment with
// OpenTofu, checks the result through the SDKs, causes drift ("someone changed it in
// the console"), and lets OpenTofu fix it. At the end, it destroys everything.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DeleteBucketCommand,
  GetBucketVersioningCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ListQueueTagsCommand,
  SQSClient,
  SetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import pg from "pg";

const CLOUD = process.env.CLOUD_URL ?? "http://cloud:4566";
const aws = {
  region: "us-east-1",
  endpoint: CLOUD,
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};
const sqs = new SQSClient(aws);
const s3 = new S3Client(aws);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const QUEUE = "morada-staging-charges";
const DLQ = "morada-staging-charges-dlq";
const BUCKET = "morada-staging-financial-reports";
const lines: string[] = [];

const env = {
  ...process.env,
  TF_VAR_cloud_url: CLOUD,
  TF_VAR_db_host: "db",
  TF_IN_AUTOMATION: "1",
};

// Runs OpenTofu; exit code 2 from "plan -detailed-exitcode" means "there are
// changes", not an error
function tofu(...args: string[]) {
  const r = spawnSync("tofu", ["-chdir=infra", ...args], { env, encoding: "utf8" });
  if (r.status !== 0 && r.status !== 2) throw new Error(`tofu ${args[0]}: ${r.stderr}`);
  return r;
}

// Reads the saved plan and counts what it would do, with the detail of each change
function readPlan(): string {
  const plan = JSON.parse(tofu("show", "-json", "plan.bin").stdout);
  const count = { create: 0, update: 0, delete: 0 };
  const details: string[] = [];
  for (const rc of plan.resource_changes ?? []) {
    const { actions, before, after } = rc.change;
    for (const a of actions as (keyof typeof count)[]) if (a in count) count[a]++;
    if (actions.includes("update")) {
      for (const field of Object.keys(after ?? {})) {
        const [b, d] = [JSON.stringify(before[field]), JSON.stringify(after[field])];
        if (b !== d) details.push(`     ${rc.address}.${field}: ${b} -> ${d}`);
      }
    }
  }
  const { create, update } = count;
  const summary = `${create} to add, ${update} to change, ${count.delete} to destroy`;
  return [summary, ...details].join("\n");
}

async function queueUrl(name: string) {
  return (await sqs.send(new GetQueueUrlCommand({ QueueName: name }))).QueueUrl!;
}

async function queueAttributes() {
  const r = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: await queueUrl(QUEUE),
      AttributeNames: ["All"],
    }),
  );
  return r.Attributes!;
}

// What really exists, asked directly of the "cloud" and of the database
async function check() {
  const attributes = await queueAttributes();
  const redrive = JSON.parse(attributes.RedrivePolicy!);
  const tags =
    (
      await sqs.send(
        new ListQueueTagsCommand({
          QueueUrl: await queueUrl(QUEUE),
        }),
      )
    ).Tags ?? {};
  const tagList = Object.entries(tags)
    .sort()
    .map(([k, v]) => `${k}=${v}`);
  const versions = await s3.send(new GetBucketVersioningCommand({ Bucket: BUCKET }));
  const owner = await db.query(`SELECT r.rolname FROM pg_database d
    JOIN pg_roles r ON r.oid = d.datdba WHERE d.datname = 'morada_reporting'`);
  lines.push(
    `   queue ${QUEUE}: visibility timeout ${attributes.VisibilityTimeout} s`,
    `     dead-lettered after ${redrive.maxReceiveCount} receives, ` +
      `to ${redrive.deadLetterTargetArn.split(":").pop()}`,
    `     tags: ${tagList.join(", ")}`,
    `   bucket ${BUCKET}: versioning ${versions.Status}`,
    `   database morada_reporting: owner ${owner.rows[0]?.rolname}`,
  );
}

// Leftovers from an interrupted run (the OpenTofu state is lost with the container)
async function cleanLeftovers() {
  for (const name of [QUEUE, DLQ]) {
    try {
      await sqs.send(new DeleteQueueCommand({ QueueUrl: await queueUrl(name) }));
    } catch {}
  }
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    await s3.send(new DeleteBucketCommand({ Bucket: BUCKET }));
  } catch {}
  await db.query("DROP DATABASE IF EXISTS morada_reporting");
  await db.query("DROP ROLE IF EXISTS reporting");
}

await cleanLeftovers();
lines.push("Morada staging infrastructure (OpenTofu, LocalStack, and PostgreSQL)");

tofu("plan", "-input=false", "-out=plan.bin");
lines.push(`1. initial plan: ${readPlan()}`);
tofu("apply", "-input=false", "plan.bin");
lines.push("2. applied; what exists, according to the SDKs:");
await check();

const unchanged = tofu("plan", "-input=false", "-detailed-exitcode", "-out=plan.bin");
lines.push(
  `3. plan again, with nothing changed (exit code ${unchanged.status}): ${readPlan()}`,
);

await sqs.send(
  new SetQueueAttributesCommand({
    QueueUrl: await queueUrl(QUEUE),
    Attributes: { VisibilityTimeout: "300" },
  }),
);
lines.push("4. someone sets the queue visibility timeout to 300 s in the console");

const drift = tofu("plan", "-input=false", "-detailed-exitcode", "-out=plan.bin");
lines.push(`5. plan (exit code ${drift.status}): ${readPlan()}`);
tofu("apply", "-input=false", "plan.bin");
const timeout = (await queueAttributes()).VisibilityTimeout;
lines.push(`6. applied: visibility timeout back to ${timeout} s`);

tofu("plan", "-input=false", "-destroy", "-out=plan.bin");
lines.push(`7. destroy plan: ${readPlan()}`);
tofu("apply", "-input=false", "plan.bin");
lines.push("8. destroyed");
await db.end();

const output = join(process.argv[2] ?? "/data", "output", "infra");
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "result.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
