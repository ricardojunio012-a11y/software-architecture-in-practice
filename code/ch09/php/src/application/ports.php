<?php
// The ports of the hexagon. The inside defines both; the outside adapts.
namespace Morada\Application;

require_once __DIR__ . '/../domain/schedule.php';

use Morada\Domain\Schedule;

// Inbound port: what the system offers, whoever drives it
interface BookingUseCases
{
    public function listSpaces(): array;

    public function book(array $request): array;

    public function cancel(string $booking, string $requestedOn): array;

    public function bookingsForSpace(string $space): array;
}

// Outbound port: what the system needs to keep the schedules
interface ScheduleRepository
{
    /** @return Schedule[] */
    public function all(): array;

    public function forSpace(string $space): Schedule;

    public function forBooking(string $booking): Schedule;

    public function save(Schedule $schedule): void;
}
