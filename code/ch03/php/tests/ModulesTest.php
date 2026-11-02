<?php
// Tests: the hidden coupling of "before" and the isolation of "after".
require_once __DIR__ . '/../src/before/services/services.php';
require_once __DIR__ . '/../src/after/charges/charges.php';
require_once __DIR__ . '/../src/after/delinquency/delinquency.php';

use Morada\Before\Config\Config;
use Morada\Before\Services\Services;
use PHPUnit\Framework\TestCase;
use function Morada\After\Charges\calculateCharges;
use function Morada\After\Delinquency\delinquencyReport;

final class ModulesTest extends TestCase
{
    private function data(): array
    {
        // Input: /data/input in the container; outside it, the chapter folder
        $file = is_file('/data/input/billing.json')
            ? '/data/input/billing.json'
            : __DIR__ . '/../../input/billing.json';
        return json_decode(file_get_contents($file), true);
    }

    private function today(): DateTimeImmutable
    {
        return new DateTimeImmutable('2026-03-02', new DateTimeZone('UTC'));
    }

    public function testBeforeDelinquencyReordersAnotherModulesCharges(): void
    {
        Config::$today = $this->today();
        Config::$data = $this->data();
        Services::calculateAll();
        $originalOrder = implode(
            ',',
            array_map(fn($c) => $c['unit']['id'], Services::$charges),
        );
        Services::generateOutput('delinquency');
        $orderAfter = implode(
            ',',
            array_map(fn($c) => $c['unit']['id'], Services::$charges),
        );
        $this->assertNotSame($originalOrder, $orderAfter);
    }

    public function testAfterDelinquencyDoesNotChangeTheCharges(): void
    {
        $data = $this->data();
        $list = calculateCharges(
            $data['community']['monthlyExpensesCents'],
            $data['units'],
            $this->today(),
        );
        $before = implode(',', array_map(fn($c) => $c->unit, $list));
        delinquencyReport('Test', $this->today(), $list);
        $this->assertSame($before, implode(',', array_map(fn($c) => $c->unit, $list)));
    }

    public function testAfterCalculatesLateChargesWithoutGlobalConfiguration(): void
    {
        [$carol] = calculateCharges(
            485000,
            [$this->data()['units'][2]],
            $this->today(),
        );
        $this->assertSame(
            [20, 1335, 445],
            [$carol->daysLate, $carol->lateFee, $carol->interest],
        );
    }
}
