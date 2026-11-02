<?php
// Unit tests for step 3: possible because the calculation was separated from the rest.
require_once __DIR__ . '/../src/step3/application.php';

use Morada\Step3\Notice;
use Morada\Step3\Invoice;
use Morada\Step3\Calculation;
use Morada\Step3\Notifier;
use PHPUnit\Framework\TestCase;
use function Morada\Step3\generateBilling;

final class Step3Test extends TestCase
{
    private function today(): DateTimeImmutable
    {
        return new DateTimeImmutable('2026-03-02', new DateTimeZone('UTC'));
    }

    private function unit(array $extra = []): array
    {
        return array_merge(
            [
                'id' => 'A-101',
                'shareMillionths' => 125000,
                'resident' => [
                    'name' => 'Anna',
                    'email' => 'anna@example.com',
                    'channel' => 'email',
                ],
                'paymentMethod' => 'invoice',
                'pastDue' => null,
            ],
            $extra,
        );
    }

    public function testSplitsExpensesByShareAndAddsReserveFund(): void
    {
        $c = Calculation::calculateCharge(485000, $this->unit(), $this->today());
        $this->assertSame(60625, $c->dues);
        $this->assertSame(6063, $c->reserve);
        $this->assertSame(66688, $c->total);
    }

    public function testChargesLateFeeAndInterestProratedByDaysLate(): void
    {
        $unit = $this->unit([
            'pastDue' => [
                'amountCents' => 66750,
                'dueDate' => '2026-02-10',
            ],
        ]);
        $c = Calculation::calculateCharge(485000, $unit, $this->today());
        $this->assertSame(1335, $c->lateFee);
        $this->assertSame(445, $c->interest); // 20 days
        $this->assertSame(66688 + 66750 + 1335 + 445, $c->total);
    }

    public function testNotifiesEachResidentOnceWithoutSendingAnything(): void
    {
        $notifier = new class implements Notifier {
            public array $notices = [];

            public function notify(Notice $notice): void
            {
                $this->notices[] = $notice;
            }
        };
        $data = [
            'community' => [
                'id' => 'test',
                'name' => 'Test Community',
                'monthlyExpensesCents' => 100000,
            ],
            'units' => [
                $this->unit(['shareMillionths' => 500000]),
                $this->unit(['id' => 'A-102', 'shareMillionths' => 500000]),
            ],
        ];
        generateBilling($data, $this->today(), new Invoice(), $notifier);
        $this->assertSame(
            ['A-101', 'A-102'],
            array_map(fn($a) => $a->charge->unit['id'], $notifier->notices),
        );
        $this->assertSame(
            'INV-test-202603-A-101-55000',
            $notifier->notices[0]->paymentCode,
        );
    }
}
