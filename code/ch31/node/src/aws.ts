// AWS adapters: they implement the ports with S3, SQS, and DynamoDB.
// Everything that belongs to AWS stays here; the core never imports the SDK.
import {
  ConditionalCheckFailedException,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, NoSuchKey, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import type { Clients } from "./clients.ts";
import type { Names } from "./infra.ts";
import type {
  Cloud,
  Document,
  Documents,
  Files,
  ReceivedTask,
  Task,
  Tasks,
} from "./ports.ts";

export class S3Files implements Files {
  private c: Clients;
  private bucket: string;
  constructor(c: Clients, bucket: string) {
    this.c = c;
    this.bucket = bucket;
  }
  async store(path: string, content: Uint8Array, type: string) {
    const request = { Bucket: this.bucket, Key: path, Body: content };
    await this.c.s3.send(new PutObjectCommand({ ...request, ContentType: type }));
  }
  async read(path: string) {
    try {
      const request = { Bucket: this.bucket, Key: path };
      const response = await this.c.s3.send(new GetObjectCommand(request));
      return await response.Body!.transformToByteArray();
    } catch (error) {
      if (error instanceof NoSuchKey) return undefined;
      throw error;
    }
  }
}

export class SqsTasks implements Tasks {
  private c: Clients;
  private url: string;
  constructor(c: Clients, url: string) {
    this.c = c;
    this.url = url;
  }
  async publish(task: Task) {
    const request = { QueueUrl: this.url, MessageBody: JSON.stringify(task) };
    await this.c.sqs.send(new SendMessageCommand(request));
  }
  async receive(max: number): Promise<ReceivedTask[]> {
    const response = await this.c.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: this.url,
        MaxNumberOfMessages: Math.min(max, 10), // SQS delivers up to 10 at a time
        WaitTimeSeconds: 1, // long polling: avoids false empty responses
      }),
    );
    return (response.Messages ?? []).map((m) => ({
      task: JSON.parse(m.Body!) as Task,
      receipt: m.ReceiptHandle!,
    }));
  }
  async ack(received: ReceivedTask) {
    const request = { QueueUrl: this.url, ReceiptHandle: received.receipt };
    await this.c.sqs.send(new DeleteMessageCommand(request));
  }
}

export class DynamoDocuments implements Documents {
  private c: Clients;
  private table: string;
  constructor(c: Clients, table: string) {
    this.c = c;
    this.table = table;
  }
  async registerIfNew(d: Document) {
    try {
      await this.c.dynamo.send(
        new PutItemCommand({
          TableName: this.table,
          Item: {
            community: { S: d.community },
            month: { S: d.month },
            path: { S: d.path },
            bytes: { N: String(d.bytes) },
          },
          // Writes only if the key does not exist: the port promises "if new"
          ConditionExpression: "attribute_not_exists(community)",
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
  async forCommunity(community: string) {
    const response = await this.c.dynamo.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "community = :c",
        ExpressionAttributeValues: { ":c": { S: community } },
        // By default, DynamoDB reads are eventually consistent; the port
        // promises to read what was just written
        ConsistentRead: true,
      }),
    );
    return (response.Items ?? []).map((i) => ({
      community: i.community.S!,
      month: i.month.S!,
      path: i.path.S!,
      bytes: Number(i.bytes.N),
    }));
  }
}

export async function awsCloud(c: Clients, names: Names): Promise<Cloud> {
  const queue = await c.sqs.send(new GetQueueUrlCommand({ QueueName: names.queue }));
  return {
    files: new S3Files(c, names.bucket),
    tasks: new SqsTasks(c, queue.QueueUrl!),
    documents: new DynamoDocuments(c, names.table),
  };
}
