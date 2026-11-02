<?php
// Who reacts to the booking events. Each does one thing and knows none of the others.
namespace Morada;

require_once __DIR__ . '/events.php';
require_once __DIR__ . '/notification.php';

final class NotifyResident implements Subscriber
{
    public function __construct(private readonly ChannelFactory $factory) {}

    public function name(): string
    {
        return 'NotifyResident';
    }

    public function handle(Event $event): void
    {
        $r = $event->request;
        $when = "{$r->space->name} on " . usDate($r->date);
        $message =
            $event->type === 'BookingConfirmed'
                ? new Message(
                    'Booking confirmed',
                    "$when. Usage fee: $" . dollars($r->space->feeCents) . '.',
                )
                : new Message('Booking rejected', "$when: {$event->reason}.");
        $resident = $r->unit->resident;
        $this->factory->forResident($resident)->send($resident, $message);
    }
}

final class ChargeUsageFee implements Subscriber
{
    public function __construct(private array &$fees) {}

    public function name(): string
    {
        return 'ChargeUsageFee';
    }

    public function handle(Event $event): void
    {
        $r = $event->request;
        $description = "Usage fee: {$r->space->name} on " . usDate($r->date);
        $this->fees[] = "{$r->unit->id};$description;" . dollars($r->space->feeCents);
    }
}

final class NotifyFrontDesk implements Subscriber
{
    public function __construct(private array &$list) {}

    public function name(): string
    {
        return 'NotifyFrontDesk';
    }

    public function handle(Event $event): void
    {
        $r = $event->request;
        $this->list[] =
            usDate($r->date) .
            " {$r->space->name}: {$r->unit->id} {$r->unit->resident->name}";
    }
}
