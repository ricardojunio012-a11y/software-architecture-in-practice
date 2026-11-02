<?php
// Domain events: facts that have already happened, in the vocabulary of the business.
namespace Morada\After\Domain;

require_once __DIR__ . '/money.php';
require_once __DIR__ . '/time-slot.php';

final readonly class BookingConfirmed
{
    public function __construct(
        public string $booking,
        public string $space,
        public TimeSlot $slot,
        public string $unit,
        public Money $fee,
    ) {}
}

final readonly class BookingCanceled
{
    public function __construct(
        public string $booking,
        public Money $cancellationFee,
    ) {}
}
