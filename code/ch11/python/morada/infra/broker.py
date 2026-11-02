# The broker (RabbitMQ): a fanout exchange delivers each event to the Bookings and
# Communications queues. Each module has its own queue and consumes at its own pace.
import json
import os

import pika

QUEUES = ["bookings.payments", "communications.payments"]


def connect_broker():
    connection = pika.BlockingConnection(pika.URLParameters(os.environ["BROKER_URL"]))
    channel = connection.channel()
    channel.confirm_delivery()
    channel.exchange_declare("payments", "fanout", durable=True)
    for queue in QUEUES:
        channel.queue_declare(queue, durable=True)
        channel.queue_purge(queue)
        channel.queue_bind(queue, "payments")
    return channel, connection


# With confirm_delivery, basic_publish returns only after the broker confirms
def publish(channel, e: dict) -> None:
    channel.basic_publish(
        "payments",
        "",
        json.dumps(e, ensure_ascii=False).encode(),
        pika.BasicProperties(delivery_mode=2, message_id=e["event"]),
    )


# Consumes the queue until it is empty; the acknowledgment (ack) comes after handling
def consume_all(channel, queue: str, handle) -> None:
    while True:
        method, _, body = channel.basic_get(queue)
        if method is None:
            return
        handle(json.loads(body))
        channel.basic_ack(method.delivery_tag)
