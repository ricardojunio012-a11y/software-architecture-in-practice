// Morada's infrastructure created through the SDK: one bucket, two queues, and
// one table, with the cost tags. Each creation first checks whether the resource
// already exists, so running it twice changes nothing (it is idempotent).
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketEncryptionCommand,
  PutBucketTaggingCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
} from "@aws-sdk/client-sqs";
import type { Clients } from "./clients.ts";

export interface Names {
  bucket: string;
  queue: string;
  deadLetter: string;
  table: string;
}

export const names = (prefix = "morada"): Names => ({
  bucket: `${prefix}-reports`,
  queue: `${prefix}-notices`,
  deadLetter: `${prefix}-notices-dead`,
  table: `${prefix}-documents`,
});

const tags = { project: "morada", module: "communications" };

// Returns one line per resource: "created" or "already existed". The visibility
// is the time, in seconds, the worker has to ack a task before it comes back
export async function provision(
  c: Clients,
  n: Names,
  visibility = 30,
): Promise<string[]> {
  const b = await bucket(c, n.bucket);
  const d = await queue(c, n.deadLetter, {});
  const extras = {
    VisibilityTimeout: String(visibility),
    ...(await redrive(c, n.deadLetter)),
  };
  const q = await queue(c, n.queue, extras);
  const t = await table(c, n.table);
  return [
    `${b.padEnd(16)}bucket  ${n.bucket}`,
    `${d.padEnd(16)}queue   ${n.deadLetter}`,
    `${q.padEnd(16)}queue   ${n.queue}`,
    `${t.padEnd(16)}table   ${n.table}`,
  ];
}

async function bucket(c: Clients, name: string) {
  try {
    await c.s3.send(new HeadBucketCommand({ Bucket: name }));
    return "already existed";
  } catch {
    // it does not exist: go on to create it
  }
  // Outside us-east-1, the bucket's region must be given at creation; in
  // us-east-1, the default region, S3 rejects it
  const location = c.region as BucketLocationConstraint;
  const configuration =
    c.region === "us-east-1"
      ? {}
      : { CreateBucketConfiguration: { LocationConstraint: location } };
  await c.s3.send(new CreateBucketCommand({ Bucket: name, ...configuration }));
  const block = {
    BlockPublicAcls: true,
    IgnorePublicAcls: true,
    BlockPublicPolicy: true,
    RestrictPublicBuckets: true,
  };
  const publicAccess = { Bucket: name, PublicAccessBlockConfiguration: block };
  await c.s3.send(new PutPublicAccessBlockCommand(publicAccess));
  const byDefault = { SSEAlgorithm: "AES256" as const }; // key managed by S3
  const encryption = { Rules: [{ ApplyServerSideEncryptionByDefault: byDefault }] };
  await c.s3.send(
    new PutBucketEncryptionCommand({
      Bucket: name,
      ServerSideEncryptionConfiguration: encryption,
    }),
  );
  const TagSet = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
  await c.s3.send(new PutBucketTaggingCommand({ Bucket: name, Tagging: { TagSet } }));
  return "created";
}

// The main queue sends to the dead-letter queue whatever fails three times
async function redrive(c: Clients, deadLetter: string) {
  const url = (await c.sqs.send(new GetQueueUrlCommand({ QueueName: deadLetter })))
    .QueueUrl;
  const request = { QueueUrl: url, AttributeNames: ["QueueArn" as const] };
  const arn = (await c.sqs.send(new GetQueueAttributesCommand(request))).Attributes!
    .QueueArn;
  const policy = { deadLetterTargetArn: arn, maxReceiveCount: 3 };
  return { RedrivePolicy: JSON.stringify(policy) };
}

async function queue(c: Clients, name: string, extras: Record<string, string>) {
  try {
    await c.sqs.send(new GetQueueUrlCommand({ QueueName: name }));
    return "already existed";
  } catch {
    // it does not exist: go on to create it
  }
  await c.sqs.send(
    new CreateQueueCommand({
      QueueName: name,
      Attributes: { SqsManagedSseEnabled: "true", ...extras },
      tags,
    }),
  );
  return "created";
}

async function table(c: Clients, name: string) {
  try {
    await c.dynamo.send(new DescribeTableCommand({ TableName: name }));
    return "already existed";
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
  }
  await c.dynamo.send(
    new CreateTableCommand({
      TableName: name,
      BillingMode: "PAY_PER_REQUEST", // on demand: pay per request
      AttributeDefinitions: [
        { AttributeName: "community", AttributeType: "S" },
        { AttributeName: "month", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "community", KeyType: "HASH" },
        { AttributeName: "month", KeyType: "RANGE" },
      ],
      Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
    }),
  );
  const wait = { client: c.dynamo, maxWaitTime: 60 };
  await waitUntilTableExists(wait, { TableName: name });
  return "created";
}

// Deletes everything, so each lab run starts from scratch. On the real AWS, a
// deleted queue can be recreated with the same name only 60 s later
export async function destroy(c: Clients, n: Names) {
  const ignore = () => {};
  const listed = await c.s3
    .send(new ListObjectsV2Command({ Bucket: n.bucket }))
    .catch(() => undefined);
  const objects = (listed?.Contents ?? []).map((o) => ({ Key: o.Key! }));
  if (objects.length > 0) {
    const request = { Bucket: n.bucket, Delete: { Objects: objects } };
    await c.s3.send(new DeleteObjectsCommand(request));
  }
  await c.s3.send(new DeleteBucketCommand({ Bucket: n.bucket })).catch(ignore);
  for (const name of [n.queue, n.deadLetter]) {
    const url = await c.sqs
      .send(new GetQueueUrlCommand({ QueueName: name }))
      .catch(() => undefined);
    if (url) await c.sqs.send(new DeleteQueueCommand({ QueueUrl: url.QueueUrl }));
  }
  await c.dynamo.send(new DeleteTableCommand({ TableName: n.table })).catch(ignore);
}
