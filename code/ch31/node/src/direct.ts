// The same use case written directly against the SDK, without ports: it is the
// baseline for measuring the cost of the abstraction in the "cost" version.
import {
  ConditionalCheckFailedException,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import type { Clients } from "./clients.ts";
import type { Names } from "./infra.ts";

// The queue address is looked up once, as the adapter does
export async function queueUrl(c: Clients, n: Names) {
  const queue = await c.sqs.send(new GetQueueUrlCommand({ QueueName: n.queue }));
  return queue.QueueUrl!;
}

export async function publishDirect(
  c: Clients,
  n: Names,
  url: string,
  community: string,
  month: string,
  pdf: Uint8Array,
) {
  const path = `reports/${community}/${month}.pdf`;
  await c.s3.send(
    new PutObjectCommand({
      Bucket: n.bucket,
      Key: path,
      Body: pdf,
      ContentType: "application/pdf",
    }),
  );
  try {
    await c.dynamo.send(
      new PutItemCommand({
        TableName: n.table,
        Item: {
          community: { S: community },
          month: { S: month },
          path: { S: path },
          bytes: { N: String(pdf.length) },
        },
        ConditionExpression: "attribute_not_exists(community)",
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return "duplicate";
    throw error;
  }
  const task = { type: "notify-residents", community, month };
  await c.sqs.send(
    new SendMessageCommand({
      QueueUrl: url,
      MessageBody: JSON.stringify(task),
    }),
  );
  return "published";
}

export async function notifyDirect(c: Clients, n: Names, url: string) {
  const notices: string[] = [];
  for (;;) {
    const batch = await c.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: url,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
      }),
    );
    if (!batch.Messages?.length) return notices.sort();
    for (const m of batch.Messages) {
      const { community, month } = JSON.parse(m.Body!);
      const file = await c.s3.send(
        new GetObjectCommand({
          Bucket: n.bucket,
          Key: `reports/${community}/${month}.pdf`,
        }),
      );
      const pdf = await file.Body!.transformToByteArray();
      notices.push(`${community} ${month}: notice sent, PDF with ${pdf.length} bytes`);
      await c.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: url,
          ReceiptHandle: m.ReceiptHandle,
        }),
      );
    }
  }
}
