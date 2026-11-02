<?php
// Controller (GRASP): coordinates the calculation and the registration without doing
// either. Depends on abstractions passed to the constructor (dependency injection).
namespace Morada\After\Issuing;

require_once __DIR__ . '/gateway.php';
require_once __DIR__ . '/../billing/calculator.php';

use Morada\After\Billing\ChargeCalculator;

final class IssuingService
{
    public function __construct(
        private readonly ChargeCalculator $calculator,
        private readonly PaymentGateway $gateway,
        private readonly Deadlines $deadlines,
    ) {}

    public function issue(array $units): array
    {
        $charges = array_map(fn($u) => $this->calculator->calculate($u), $units);
        $registrations = array_map(
            fn($c) => $this->gateway->register($c, $this->deadlines),
            $charges,
        );
        return [$charges, $registrations];
    }
}
