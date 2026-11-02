<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// Composition root: the only place that knows the concrete classes and assembles them.
foreach (glob(__DIR__ . '/billing/rules/*.php') as $rule) {
    require_once $rule;
}
require_once __DIR__ . '/issuing/issuing-service.php';
require_once __DIR__ . '/providers/alpha-bank-gateway.php';
require_once __DIR__ . '/providers/easy-pay-gateway.php';
require_once __DIR__ . '/reports.php';

use Morada\After\Billing\ChargeCalculator;
use Morada\After\Billing\Rules\{BoardPresidentExemption, EarlyPaymentDiscount};
use Morada\After\Billing\Rules\{LateFee, LateInterest, MonthlyDues};
use Morada\After\Billing\Rules\{PastDueBalance, ReserveFund};
use Morada\After\Issuing\{Deadlines, IssuingService};
use Morada\After\Providers\{AlphaBankGateway, EasyPayGateway};
use Morada\External\{AlphaBankClient, EasyPayApi};
use function Morada\Shared\{dateInMonth, monthLabel};
use function Morada\After\Reports\{chargeReport, registrationReport};

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
$data = json_decode(file_get_contents($input), true);
$p = $data['policy'];
$deadlines = new Deadlines(
    dueDate: dateInMonth($today, $p['dueDay']),
    discountUntil: dateInMonth($today, $p['discountByDay']),
);

// Order matters: each rule sees what the previous ones posted
$rules = [
    new MonthlyDues($data['community']['monthlyExpensesCents']),
    new ReserveFund($p['reserveFundPercent']),
    new BoardPresidentExemption(),
    new PastDueBalance(),
    new LateFee($p['lateFeePercent']),
    new LateInterest($p['monthlyInterestPercent'], $today),
    // Last: the discount depends on the exemption and the past-due balance already posted
    new EarlyPaymentDiscount($p['earlyDiscountPercent'], $deadlines->discountUntil),
];
$gateways = [
    'alpha' => fn() => new AlphaBankGateway(new AlphaBankClient()),
    'easypay' => fn() => new EasyPayGateway(new EasyPayApi()),
];
$gateway = $gateways[getenv('GATEWAY') ?: 'alpha']();
$service = new IssuingService(new ChargeCalculator($rules), $gateway, $deadlines);

[$charges, $registrations] = $service->issue($data['units']);
$title = monthLabel($today) . ' - ' . $data['community']['name'];
@mkdir($output, 0777, true);
file_put_contents("$output/charges.txt", chargeReport($title, $charges, $deadlines));
file_put_contents(
    "$output/registrations.txt",
    registrationReport($title, $gateway->name(), $charges, $registrations),
);
echo "charges issued in $output ({$gateway->name()})\n";
