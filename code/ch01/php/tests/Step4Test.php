<?php
// Unit tests for the three changes, made on the refactored code.
require_once __DIR__ . '/../src/step4/application.php';

use Morada\Step4\Notice;
use Morada\Step4\Invoice;
use Morada\Step4\Calculation;
use Morada\Step4\Notifier;
use Morada\Step4\Card;
use PHPUnit\Framework\TestCase;
use function Morada\Step4\generateBilling;

final class Step4Test extends TestCase
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

    public function testGivesEarlyPaymentDiscountWithoutPastDueBalance(): void
    {
        $c = Calculation::calculateCharge(485000, $this->unit(), $this->today());
        $this->assertSame(66688 - 3031, $c->totalBy5th);
    }

    public function testGivesNoDiscountWithPastDueBalance(): void
    {
        $unit = $this->unit([
            'pastDue' => ['amountCents' => 1000, 'dueDate' => '2026-02-10'],
        ]);
        $this->assertNull(
            Calculation::calculateCharge(485000, $unit, $this->today())->totalBy5th,
        );
    }

    public function testUsesCardAndSmsWhenTheUnitAsks(): void
    {
        $fake = fn() => new class implements Notifier {
            public array $codes = [];

            public function notify(Notice $notice): void
            {
                $this->codes[] = $notice->paymentCode;
            }
        };
        $email = $fake();
        $sms = $fake();
        $data = [
            'community' => [
                'id' => 'test',
                'name' => 'Test Community',
                'monthlyExpensesCents' => 100000,
            ],
            'units' => [
                $this->unit(['shareMillionths' => 500000]),
                $this->unit([
                    'id' => 'A-102',
                    'shareMillionths' => 500000,
                    'paymentMethod' => 'card',
                    'resident' => [
                        'name' => 'Beth',
                        'email' => 'beth@example.com',
                        'phone' => '+1 555-0100',
                        'channel' => 'sms',
                    ],
                ]),
            ],
        ];
        generateBilling(
            $data,
            $this->today(),
            ['invoice' => new Invoice(), 'card' => new Card()],
            ['email' => $email, 'sms' => $sms],
        );
        $this->assertSame(['INV-test-202603-A-101-55000'], $email->codes);
        $this->assertSame(['CARD-test-202603-A-102-55000'], $sms->codes);
    }
}
