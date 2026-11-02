<?php
// The broker (RabbitMQ): a fanout exchange delivers each event to the Bookings and
// Communications queues. Each module has its own queue and consumes at its own pace.
namespace Morada\Infra;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

const QUEUES = ['bookings.payments', 'communications.payments'];

function connectBroker(): array
{
    $u = parse_url(getenv('BROKER_URL'));
    $connection = new AMQPStreamConnection(
        $u['host'],
        $u['port'],
        $u['user'],
        $u['pass'],
    );
    $channel = $connection->channel();
    $channel->confirm_select();
    $channel->exchange_declare('payments', 'fanout', false, true, false);
    foreach (QUEUES as $queue) {
        $channel->queue_declare($queue, false, true, false, false);
        $channel->queue_purge($queue);
        $channel->queue_bind($queue, 'payments');
    }
    return [$channel, $connection];
}

// Counts as published only after the broker confirms receipt
function publish(AMQPChannel $channel, array $e): void
{
    $message = new AMQPMessage(json_encode($e, JSON_UNESCAPED_UNICODE), [
        'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
        'message_id' => $e['event'],
    ]);
    $channel->basic_publish($message, 'payments');
    $channel->wait_for_pending_acks();
}

// Consumes the queue until it is empty; the acknowledgment (ack) comes after handling
function consumeAll(AMQPChannel $channel, string $queue, callable $handle): void
{
    while (($message = $channel->basic_get($queue)) !== null) {
        $handle(json_decode($message->getBody(), true));
        $message->ack();
    }
}
