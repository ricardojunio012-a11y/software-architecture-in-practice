<?php
// Observer: whoever publishes an event does not know who reacts to it.
namespace Morada;

require_once __DIR__ . '/types.php';

final readonly class Event
{
    // $type: "BookingConfirmed" or "BookingRejected"
    public function __construct(
        public string $type,
        public BookingRequest $request,
        public ?string $reason = null,
    ) {}
}

interface Subscriber
{
    public function name(): string;

    public function handle(Event $event): void;
}

final class EventBus
{
    /** @var array<string, Subscriber[]> */
    private array $subscribers = [];
    /** @var string[] */
    public array $failures = [];

    public function subscribe(string $type, Subscriber $subscriber): void
    {
        $this->subscribers[$type][] = $subscriber;
    }

    // A subscriber that fails does not stop the others from receiving the event
    public function publish(Event $event): void
    {
        foreach ($this->subscribers[$event->type] ?? [] as $subscriber) {
            try {
                $subscriber->handle($event);
            } catch (\Throwable $error) {
                $this->failures[] =
                    "{$event->type} {$event->request->id}: " .
                    "{$subscriber->name()}: {$error->getMessage()}";
            }
        }
    }
}
