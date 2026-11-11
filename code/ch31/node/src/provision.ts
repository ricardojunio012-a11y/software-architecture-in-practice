// The "provision" version: creates Morada's infrastructure through the SDK, runs
// again to show that nothing changes, and checks the result by reading it back.
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  GetBucketEncryptionCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
  GetPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import { GetQueueAttributesCommand, GetQueueUrlCommand } from "@aws-sdk/client-sqs";
import { createClients } from "./clients.ts";
import { destroy, names, provision } from "./infra.ts";
import { write } from "./output.ts";

const c = createClients();
const n = names();
await destroy(c, n);

const lines = [`region: ${c.region}`, "first run"];
for (const l of await provision(c, n)) lines.push("  " + l);
lines.push("second run");
for (const l of await provision(c, n)) lines.push("  " + l);

// The check reads each setting back, instead of trusting the request
const b = { Bucket: n.bucket };
const location = await c.s3.send(new GetBucketLocationCommand(b));
// S3 reports a bucket in us-east-1 with an empty location (a legacy of the API)
const region = location.LocationConstraint || "us-east-1";
const encryption = await c.s3.send(new GetBucketEncryptionCommand(b));
const algorithm =
  encryption.ServerSideEncryptionConfiguration!.Rules![0]
    .ApplyServerSideEncryptionByDefault!.SSEAlgorithm;
const block = await c.s3.send(new GetPublicAccessBlockCommand(b));
const closed = Object.values(block.PublicAccessBlockConfiguration!).every(
  (v) => v === true,
);
const tags = (await c.s3.send(new GetBucketTaggingCommand(b))).TagSet!;
lines.push(
  "check, read back from the cloud",
  `  bucket ${n.bucket}: ${region}, ${algorithm}, ` +
    `public access ${closed ? "blocked" : "OPEN"}`,
);

const url = (await c.sqs.send(new GetQueueUrlCommand({ QueueName: n.queue }))).QueueUrl;
const request = { QueueUrl: url, AttributeNames: ["All" as const] };
const attributes = (await c.sqs.send(new GetQueueAttributesCommand(request)))
  .Attributes!;
const policy = JSON.parse(attributes.RedrivePolicy!);
lines.push(
  `  queue ${n.queue}: visibility ${attributes.VisibilityTimeout} s, ` +
    `${policy.maxReceiveCount} deliveries, then ` +
    policy.deadLetterTargetArn.split(":").at(-1),
);

const t = await c.dynamo.send(new DescribeTableCommand({ TableName: n.table }));
const key = t.Table!.KeySchema!.map((k) => k.AttributeName).join(" + ");
const mode = t.Table!.BillingModeSummary?.BillingMode ?? "PROVISIONED";
lines.push(
  `  table ${n.table}: ${mode}, key ${key}, ${t.Table!.TableStatus}`,
  "  bucket tags: " +
    tags
      .map((x) => `${x.Key}=${x.Value}`)
      .sort()
      .join(", "),
);
write("provision", lines);
