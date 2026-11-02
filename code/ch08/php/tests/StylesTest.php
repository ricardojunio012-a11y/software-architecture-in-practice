<?php
// Tests: each layer can be tested without the ones above it; the core, without real
// plugins.
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/layers/presentation/api.php';
require_once __DIR__ . '/../src/plugins/core.php';

use Morada\Layers\Application\BookingService;
use Morada\Layers\Data\ScheduleRepository;
use Morada\Layers\Domain\{Schedule, Space, RuleViolationError};
use Morada\Plugins\{Charge, Core, BankPlugin};
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\{ServerRequestFactory, StreamFactory};

use function Morada\Layers\Presentation\createApi;

final class StylesTest extends TestCase
{
    private function partyRoom(): Space
    {
        return new Space('party-room', 15000, 2);
    }

    public function testTheDomainRejectsAnOverlappingSlotWithoutKnowingHttpExists(): void
    {
        $schedule = new Schedule($this->partyRoom());
        $schedule->book('R-1', 'A-101', '2026-03-14', 14, 22, '2026-03-02');
        $this->expectException(RuleViolationError::class);
        $schedule->book('R-2', 'A-202', '2026-03-14', 20, 23, '2026-03-02');
    }

    public function testThePresentationLayerTurnsTheViolatedRuleInto409(): void
    {
        $api = createApi(
            new BookingService(new ScheduleRepository([$this->partyRoom()])),
        );
        $body = [
            'booking' => 'R-1',
            'unit' => 'A-101',
            'space' => 'party-room',
            'date' => '2026-03-03',
            'start' => 10,
            'end' => 12,
            'requestedOn' => '2026-03-02',
        ];
        $req = (new ServerRequestFactory())
            ->createServerRequest('POST', '/bookings')
            ->withHeader('Content-Type', 'application/json')
            ->withBody((new StreamFactory())->createStream(json_encode($body)));
        $this->assertSame(409, $api->handle($req)->getStatusCode());
    }

    private function plugin(string $name, callable $register): BankPlugin
    {
        return new class ($name, $register) implements BankPlugin {
            public function __construct(private string $n, private $r) {}

            public function name(): string
            {
                return $this->n;
            }

            public function register(Charge $charge): string
            {
                return ($this->r)($charge);
            }
        };
    }

    public function testIssuesThroughTheInstalledPluginAndReportsAMissingPlugin(): void
    {
        $core = new Core();
        $core->install($this->plugin('test', fn($c) => "T-{$c->unit}"));
        $this->assertSame(
            'A-1;$1.00;test;T-A-1',
            $core->issue(new Charge('A-1', 100, 'test')),
        );
        $this->assertSame(
            'A-1;$1.00;zeta;no plugin for bank zeta',
            $core->issue(new Charge('A-1', 100, 'zeta')),
        );
    }

    public function testAFaultyPluginDoesNotBringDownTheCore(): void
    {
        $core = new Core();
        $core->install(
            $this->plugin(
                'broken',
                fn() => throw new RuntimeException('out of service'),
            ),
        );
        $this->assertSame(
            'A-1;$1.00;broken;plugin broken failed: out of service',
            $core->issue(new Charge('A-1', 100, 'broken')),
        );
    }

    public function testRejectsAPluginThatDoesNotFulfillTheContract(): void
    {
        $this->expectExceptionMessage('contract');
        (new Core())->install(new stdClass());
    }
}
