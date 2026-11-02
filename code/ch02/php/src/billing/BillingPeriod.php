<?php
// The billing period of the charge and the dates that depend on it.
namespace Morada\Billing;

final class BillingPeriod
{
    public function __construct(
        public readonly \DateTimeImmutable $today,
        public readonly string $label, // "03/2026"
        public readonly string $code, // "202603"
        public readonly string $dueDate, // "03/10/2026"
        public readonly string $discountDeadline,
    ) {
        // "03/05/2026"
    }

    public static function of(\DateTimeImmutable $today): self
    {
        $year = $today->format('Y');
        $month = $today->format('m');
        return new self(
            $today,
            "$month/$year",
            "$year$month",
            "$month/10/$year",
            "$month/05/$year",
        );
    }

    // Calendar days between a date (YYYY-MM-DD) and today
    public static function daysSince(string $isoDate, \DateTimeImmutable $today): int
    {
        return (new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC')))->diff(
            $today,
        )->days;
    }
}
