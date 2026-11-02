<?php
// Entity: it has an identity (the id) and a life cycle. It changes only through its
// own methods.
namespace Morada\After\Domain;

require_once __DIR__ . '/money.php';
require_once __DIR__ . '/time-slot.php';

final class Booking
{
    private string $status = 'confirmed';

    public function __construct(
        public readonly string $id,
        public readonly string $unit,
        public readonly TimeSlot $slot,
        public readonly Money $fee,
    ) {}

    public function isActive(): bool
    {
        return $this->status === 'confirmed';
    }

    public function cancel(): void
    {
        if (!$this->isActive()) {
            throw new DomainError('booking is not confirmed');
        }
        $this->status = 'canceled';
    }
}
