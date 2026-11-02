<?php
// Executable quality scenarios: they generate a synthetic load, measure what is ours,
// estimate what depends on third parties and compare the total with the target.
namespace Morada;

require_once __DIR__ . '/billing/Money.php';
require_once __DIR__ . '/billing/BillingPeriod.php';
require_once __DIR__ . '/billing/Calculation.php';
require_once __DIR__ . '/billing/Payment.php';
require_once __DIR__ . '/billing/Notification.php';

use Morada\Billing\BillingPeriod;
use Morada\Billing\Calculation;
use Morada\Billing\EmailToFile;
use Morada\Billing\Invoice;
use Morada\Billing\Notice;

final class Result
{
    public function __construct(
        public readonly array $scenario,
        public readonly int $charges,
        public readonly float $calculationSeconds, // measured
        public readonly float $processorSeconds, // estimated
        public readonly int $noticeBytes,
        public readonly bool $passed,
    ) {}
}

// Synthetic, deterministic community: the same load in every language
function syntheticCommunity(int $i, int $units): array
{
    $list = [];
    for ($k = 1; $k <= $units; $k++) {
        $list[] = [
            'id' => "U-$k",
            'shareMillionths' => intdiv(1000000, $units),
            'resident' => [
                'name' => "Resident $k",
                'email' => "resident$k@example.com",
                'channel' => 'email',
            ],
            'paymentMethod' => 'invoice',
            'pastDue' =>
                $k % 7 === 0
                    ? ['amountCents' => 50000, 'dueDate' => '2026-02-10']
                    : null,
        ];
    }
    $expenses = 3000000 + ($i % 50) * 10000;
    return [
        'community' => [
            'id' => "community-$i",
            'name' => "Community $i",
            'monthlyExpensesCents' => $expenses,
        ],
        'units' => $list,
    ];
}

// The scenario's response measure: finish within the limit
function evaluate(float $seconds, float $limitSeconds): bool
{
    return $seconds <= $limitSeconds;
}

function run(array $scenario, \DateTimeImmutable $today): Result
{
    $invoice = new Invoice();
    $period = BillingPeriod::of($today);
    $charges = 0;
    $noticeBytes = 0;
    $start = hrtime(true);
    for ($i = 1; $i <= $scenario['communities']; $i++) {
        $data = syntheticCommunity($i, $scenario['unitsPerCommunity']);
        $community = $data['community'];
        foreach ($data['units'] as $unit) {
            $charge = Calculation::calculateCharge(
                $community['monthlyExpensesCents'],
                $unit,
                $today,
            );
            $code = $invoice->generateCode($community['id'], $period, $charge);
            $notice = new Notice(
                $community['name'],
                $period,
                $charge,
                $invoice->name(),
                $code,
            );
            $noticeBytes += strlen(EmailToFile::format($notice));
            $charges++;
        }
    }
    $calculationSeconds = (hrtime(true) - $start) / 1e9;
    // Creating the invoices depends on the payment processor: estimated from its capacity
    $processorSeconds = $charges / $scenario['invoicesPerSecond'];
    $total = $calculationSeconds + $processorSeconds;
    return new Result(
        $scenario,
        $charges,
        $calculationSeconds,
        $processorSeconds,
        $noticeBytes,
        evaluate($total, $scenario['limitSeconds']),
    );
}
