<?php
// Repository: whoever uses the bookings does not know where they are stored.
namespace Morada;

require_once __DIR__ . '/types.php';
require_once __DIR__ . '/state.php';

interface BookingRepository
{
    public function save(Booking $booking): void;

    // Checks and saves in a single operation: in the database, a uniqueness constraint
    public function saveIfFree(Booking $booking): bool;

    public function find(string $id): ?Booking;

    public function isTaken(string $space, string $date): bool;

    public function countInMonth(string $unit, string $space, string $month): int;
}

// In memory for the lab; chapter 16 replaces it with a database.
// Keeps every booking; the queries count only the approved ones.
final class InMemoryRepository implements BookingRepository
{
    /** @var Booking[] */
    private array $bookings = [];

    public function save(Booking $booking): void
    {
        $this->bookings[] = $booking;
    }

    public function saveIfFree(Booking $booking): bool
    {
        if ($this->isTaken($booking->request->space->id, $booking->request->date)) {
            return false;
        }
        $this->save($booking);
        return true;
    }

    public function find(string $id): ?Booking
    {
        foreach ($this->bookings as $b) {
            if ($b->request->id === $id) {
                return $b;
            }
        }
        return null;
    }

    public function isTaken(string $space, string $date): bool
    {
        foreach ($this->approved() as $r) {
            if ($r->space->id === $space && $r->date === $date) {
                return true;
            }
        }
        return false;
    }

    public function countInMonth(string $unit, string $space, string $month): int
    {
        return count(
            array_filter(
                $this->approved(),
                fn(BookingRequest $r) => $r->unit->id === $unit &&
                    $r->space->id === $space &&
                    str_starts_with($r->date, $month),
            ),
        );
    }

    /** @return BookingRequest[] */
    private function approved(): array
    {
        $approved = [];
        foreach ($this->bookings as $b) {
            if ($b->state() === 'approved') {
                $approved[] = $b->request;
            }
        }
        return $approved;
    }
}
