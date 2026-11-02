<?php
// Tests: what the before version cannot test and what the after version isolates.
require_once __DIR__ . '/../src/before/issuing.php';
foreach (glob(__DIR__ . '/../src/after/billing/rules/*.php') as $rule) {
    require_once $rule;
}
require_once __DIR__ . '/../src/after/issuing/issuing-service.php';

use Morada\After\Billing\{ChargeCalculator, Charge, Entry, Rule};
use Morada\After\Billing\Rules\{
    BoardPresidentExemption,
    EarlyPaymentDiscount,
    MonthlyDues,
    PastDueBalance,
    ReserveFund,
};
use Morada\After\Issuing\{Deadlines, IssuingService, PaymentGateway, Registration};
use Morada\External\AlphaBankClient;
use PHPUnit\Framework\TestCase;
use function Morada\Before\issueCharges;

// Test double: implements the interface and only records what it received
final class InMemoryGateway implements PaymentGateway
{
    public array $received = [];

    public function name(): string
    {
        return 'in memory';
    }

    public function register(Charge $charge, Deadlines $deadlines): Registration
    {
        $this->received[] = $charge;
        return new Registration($charge->unit, 'test');
    }
}

final class IssuingTest extends TestCase
{
    private function data(): array
    {
        // Input: /data/input in the container; outside it, the chapter folder
        $file = is_file('/data/input/community.json')
            ? '/data/input/community.json'
            : __DIR__ . '/../../input/community.json';
        return json_decode(file_get_contents($file), true);
    }

    public function testBeforeCalculatingTheChargesAlsoCreatesInvoicesAtTheBank(): void
    {
        $before = AlphaBankClient::$issued;
        issueCharges($this->data(), new DateTimeImmutable('2026-03-02'));
        $this->assertSame(8, AlphaBankClient::$issued - $before);
    }

    public function testAfterANewRuleGoesInWithoutChangingTheCalculator(): void
    {
        $d = $this->data();
        $extraFee = new class implements Rule {
            public function apply(array $unit, array $posted): array
            {
                return [new Entry('assessment', 'Special assessment', 5000)];
            }
        };
        $calculator = new ChargeCalculator([
            new MonthlyDues($d['community']['monthlyExpensesCents']),
            $extraFee,
        ]);
        $this->assertSame(
            60625 + 5000,
            $calculator->calculate($d['units'][0])->total(),
        );
    }

    public function testAfterBoardPresidentIsExemptFromDuesAndPaysTheReserve(): void
    {
        $d = $this->data();
        $calculator = new ChargeCalculator([
            new MonthlyDues($d['community']['monthlyExpensesCents']),
            new ReserveFund(10),
            new BoardPresidentExemption(),
        ]);
        $president = array_values(
            array_filter($d['units'], fn($u) => !empty($u['boardPresident'])),
        )[0];
        $this->assertSame(6790, $calculator->calculate($president)->total());
    }

    public function testAfterAUnitInArrearsDoesNotGetTheEarlyPaymentDiscount(): void
    {
        $d = $this->data();
        $calculator = new ChargeCalculator([
            new MonthlyDues($d['community']['monthlyExpensesCents']),
            new PastDueBalance(),
            new EarlyPaymentDiscount(5, '2026-03-05'),
        ]);
        $byId = array_column($d['units'], null, 'id');
        $this->assertSame(3031, $calculator->calculate($byId['A-101'])->discount());
        $this->assertSame(0, $calculator->calculate($byId['A-201'])->discount());
    }

    public function testAfterIssuingWorksWithAnyGatewayWithoutARealBank(): void
    {
        $d = $this->data();
        $gateway = new InMemoryGateway();
        $calculator = new ChargeCalculator([
            new MonthlyDues($d['community']['monthlyExpensesCents']),
        ]);
        $before = AlphaBankClient::$issued;
        $deadlines = new Deadlines('2026-03-10', '2026-03-05');
        (new IssuingService($calculator, $gateway, $deadlines))->issue($d['units']);
        $this->assertCount(8, $gateway->received);
        $this->assertSame($before, AlphaBankClient::$issued);
    }
}
