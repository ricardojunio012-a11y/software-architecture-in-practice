<?php
// Rules for calculating the monthly dues: reads no file and sends nothing.
namespace Morada\Step3;

final class Charge
{
    public function __construct(
        public readonly array $unit,
        public readonly int $dues,
        public readonly int $reserve,
        public readonly int $arrears,
        public readonly int $lateFee,
        public readonly int $interest,
        public readonly int $total,
    ) {}
}

final class Calculation
{
    private const RESERVE_FUND = 10; // % of the dues
    private const LATE_FEE = 2; // % of the past-due balance (set by the CC&Rs)

    // 1% a month, prorated by the days late
    public static function lateInterest(int $cents, int $days): int
    {
        return intdiv($cents * $days + 1500, 3000);
    }

    public static function calculateCharge(
        int $expensesCents,
        array $unit,
        \DateTimeImmutable $today,
    ): Charge {
        $dues = Money::shareOf($expensesCents, $unit['shareMillionths']);
        $reserve = Money::percentOf($dues, self::RESERVE_FUND);
        $arrears = 0;
        $lateFee = 0;
        $interest = 0;
        if ($unit['pastDue'] !== null) {
            $arrears = $unit['pastDue']['amountCents'];
            $lateFee = Money::percentOf($arrears, self::LATE_FEE);
            $interest = self::lateInterest(
                $arrears,
                BillingPeriod::daysSince($unit['pastDue']['dueDate'], $today),
            );
        }
        return new Charge(
            $unit,
            $dues,
            $reserve,
            $arrears,
            $lateFee,
            $interest,
            $dues + $reserve + $arrears + $lateFee + $interest,
        );
    }
}
