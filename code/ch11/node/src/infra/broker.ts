// The broker (RabbitMQ): a fanout exchange delivers each event to the Bookings and
// Communications queues. Each module has its own queue and consumes at its own pace.
import amqp from "amqplib";
import type { PaymentConfirmed } from "../events.ts";

export const QUEUES = ["bookings.payments", "communications.payments"];

export async function connectBroker() {
  const connection = await amqp.connect(process.env.BROKER_URL!);
  const channel = await connection.createConfirmChannel();
  await channel.assertExchange("payments", "fanout", { durable: true });
  for (const queue of QUEUES) {
    await channel.assertQueue(queue, { durable: true });
    await channel.purgeQueue(queue);
    await channel.bindQueue(queue, "payments", "");
  }
  return { channel, close: () => connection.close() };
}

// Counts as published only after the broker confirms receipt
export async function publish(channel: amqp.ConfirmChannel, e: PaymentConfirmed) {
  channel.publish("payments", "", Buffer.from(JSON.stringify(e)), {
    persistent: true,
    messageId: e.event,
  });
  await channel.waitForConfirms();
}

// Consumes the queue until it is empty; the acknowledgment (ack) comes after handling
export async function consumeAll(
  channel: amqp.ConfirmChannel,
  queue: string,
  handle: (e: PaymentConfirmed) => void,
) {
  for (;;) {
    const message = await channel.get(queue);
    if (!message) return;
    handle(JSON.parse(message.content.toString()));
    channel.ack(message);
  }
}
