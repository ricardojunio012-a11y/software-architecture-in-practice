<?php
// The use cases implement the inbound port and use the outbound port. They do not know
// whether HTTP or the terminal called them, nor where the schedules are kept.
namespace Morada\Application;

require_once __DIR__ . '/ports.php';

use function Morada\Domain\dollars;
use function Morada\Domain\slot;

final class BookingService implements BookingUseCases
{
    public function __construct(private readonly ScheduleRepository $schedules) {}

    public function listSpaces(): array
    {
        return array_map(
            fn($s) => [
                'id' => $s->space->id,
                'fee' => dollars($s->space->feeCents),
                'minNoticeDays' => $s->space->minNoticeDays,
            ],
            $this->schedules->all(),
        );
    }

    public function book(array $r): array
    {
        $schedule = $this->schedules->forSpace($r['space']);
        $b = $schedule->book(
            $r['booking'],
            $r['unit'],
            $r['date'],
            $r['start'],
            $r['end'],
            $r['requestedOn'],
        );
        $this->schedules->save($schedule);
        return [
            'booking' => $b->id,
            'status' => 'confirmed',
            'fee' => dollars($b->feeCents),
        ];
    }

    public function cancel(string $booking, string $requestedOn): array
    {
        $schedule = $this->schedules->forBooking($booking);
        $fee = $schedule->cancel($booking, $requestedOn);
        $this->schedules->save($schedule);
        return [
            'booking' => $booking,
            'status' => 'canceled',
            'cancellationFee' => dollars($fee),
        ];
    }

    public function bookingsForSpace(string $space): array
    {
        return array_map(
            fn($b) => [
                'booking' => $b->id,
                'unit' => $b->unit,
                'slot' => slot($b),
            ],
            $this->schedules->forSpace($space)->bookings(),
        );
    }
}
