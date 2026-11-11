// The AWS SDK clients, created in one place. This is the only file that knows
// that, in the lab, "AWS" is LocalStack: in production, without the
// AWS_ENDPOINT_URL variable, the same clients talk to the real AWS.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";

// Counts the calls made to AWS, per service and per command
export class Counter {
  readonly calls = new Map<string, number>();
  count(service: string, command: string) {
    const key = `${service} ${command}`;
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);
  }
  total(filter = "") {
    let sum = 0;
    for (const [key, n] of this.calls) if (key.startsWith(filter)) sum += n;
    return sum;
  }
  reset() {
    this.calls.clear();
  }
}

export interface Clients {
  s3: S3Client;
  sqs: SQSClient;
  dynamo: DynamoDBClient;
  region: string;
}

export function createClients(counter = new Counter()): Clients {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const endpoint = process.env.AWS_ENDPOINT_URL;
  // LocalStack does not resolve names like bucket.s3.amazonaws.com: S3 uses
  // path-style addressing (endpoint/bucket/key)
  const s3 = new S3Client({ region, endpoint, forcePathStyle: !!endpoint });
  const sqs = new SQSClient({ region, endpoint });
  const dynamo = new DynamoDBClient({ region, endpoint });
  // A middleware in each client counts the command before it goes out
  const count = (service: string, command = "?") =>
    counter.count(service, command.replace(/Command$/, ""));
  const options = { step: "initialize" as const };
  s3.middlewareStack.add(
    (next, context) => async (args) => {
      count("S3", context.commandName);
      return next(args);
    },
    options,
  );
  sqs.middlewareStack.add(
    (next, context) => async (args) => {
      count("SQS", context.commandName);
      return next(args);
    },
    options,
  );
  dynamo.middlewareStack.add(
    (next, context) => async (args) => {
      count("DynamoDB", context.commandName);
      return next(args);
    },
    options,
  );
  return { s3, sqs, dynamo, region };
}
