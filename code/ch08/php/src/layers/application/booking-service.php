<?php
// Application layer: the use cases. It takes plain data, calls the domain and the
// repository, and returns plain data. It does not know HTTP exists.
namespace Morada\Layers\Application;

require_once __DIR__ . '/../data/repository.php';

use Morada\Layers\Data\ScheduleRepository;

use function Morada\Layers\Domain\dollars;

function hour(int $h): string
{
    return sprintf('%02d:00', $h);
}

final class BookingService
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
        return [
            'booking' => $b->id,
            'status' => 'confirmed',
            'fee' => dollars($b->feeCents),
        ];
    }

    public function cancel(string $booking, string $on): array
    {
        $fee = $this->schedules->forBooking($booking)->cancel($booking, $on);
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
                'slot' => "{$b->date} " . hour($b->start) . '-' . hour($b->end),
            ],
            $this->schedules->forSpace($space)->bookings(),
        );
    }
}
