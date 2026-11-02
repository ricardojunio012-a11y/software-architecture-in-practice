<?php
// Tests: each pattern in isolation, with test doubles in place of the providers.
require_once __DIR__ . '/../src/subscribers.php';
require_once __DIR__ . '/../src/service.php';

use Morada\{Booking, BookingRequest, ChannelFactory, Decision, Email, Event, EventBus};
use Morada\{InMemoryRepository, Message, MinimumNotice, Resident, SimulatedProvider};
use Morada\{Sms, Space, Subscriber, Unit, UnitInGoodStanding, WithLogging, WithRetries};
use PHPUnit\Framework\TestCase;

final class PatternsTest extends TestCase
{
    private function resident(string $channel = 'sms'): Resident
    {
        return new Resident('David', 'd@x.com', $channel, '+1');
    }

    private function request(
        bool $inArrears = false,
        string $date = '2026-03-03',
    ): BookingRequest {
        $unit = new Unit('A-1', $inArrears, $this->resident());
        return new BookingRequest(
            'R-1',
            $unit,
            new Space('party-room', 'Party room', 15000, 2, 1),
            $date,
        );
    }

    public function testDecoratorRetriesOutsideAndLoggingInside(): void
    {
        $provider = new SimulatedProvider(['+1' => 2]);
        $log = [];
        $waits = [];
        $channel = new WithRetries(
            new WithLogging(new Sms($provider), $log),
            3,
            function (int $ms) use (&$waits) {
                $waits[] = $ms;
            },
        );
        $channel->send($this->resident(), new Message('Test', 'hello'));
        $this->assertSame(
            [
                'sms to David: failed (provider unavailable)',
                'sms to David: failed (provider unavailable)',
                'sms to David: delivered (Test)',
            ],
            $log,
        );
        $this->assertSame([100, 200], $waits); // growing wait
    }

    public function testDecoratorPermanentFailureIsNotRetried(): void
    {
        $provider = new SimulatedProvider([], ['d@x.com']);
        $log = [];
        $channel = new WithRetries(
            new WithLogging(new Email($provider), $log),
            3,
            fn() => null,
        );
        try {
            $channel->send($this->resident(), new Message('Test', 'hello'));
            $this->fail('should have failed');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('without retry', $error->getMessage());
        }
        $this->assertCount(1, $log);
    }

    public function testStateTheBookingAcceptsOnlyItsStateTransitions(): void
    {
        $booking = new Booking($this->request(false, '2026-03-03'));
        $booking->approve();
        $booking->cancel();
        $this->assertSame('canceled', $booking->state());
        $this->expectExceptionMessage('cannot approve a canceled booking');
        $booking->approve();
    }

    public function testRepositorySaveIfFreeRejectsTheSecondRequest(): void
    {
        $bookings = new InMemoryRepository();
        $first = new Booking($this->request(false, '2026-03-03'));
        $this->assertTrue($bookings->saveIfFree($first));
        $first->approve();
        $second = new Booking($this->request(false, '2026-03-03'));
        $this->assertFalse($bookings->saveIfFree($second));
    }

    public function testFactoryPicksByChannelAndFallsBackToEmail(): void
    {
        $log = [];
        $factory = new ChannelFactory(new SimulatedProvider([]), $log, fn() => null);
        $this->assertSame('sms', $factory->forResident($this->resident())->name());
        $this->assertSame(
            'email',
            $factory->forResident($this->resident('carrier-pigeon'))->name(),
        );
    }

    public function testChainTheFirstStageThatRejectsDecidesTheReason(): void
    {
        $chain = new UnitInGoodStanding();
        $chain->andThen(new MinimumNotice(new DateTimeImmutable('2026-03-02')));
        $this->assertSame(
            'unit in arrears',
            $chain->evaluate($this->request(inArrears: true))->reason,
        );
        $this->assertSame(
            'minimum notice of 2 days',
            $chain->evaluate($this->request())->reason,
        );
        $this->assertEquals(
            new Decision(true),
            $chain->evaluate($this->request(date: '2026-03-10')),
        );
    }

    public function testObserverAFailingSubscriberDoesNotStopTheOthers(): void
    {
        $events = new EventBus();
        $received = new ArrayObject();
        $events->subscribe(
            'BookingConfirmed',
            new class implements Subscriber {
                public function name(): string
                {
                    return 'Broken';
                }

                public function handle(Event $event): void
                {
                    throw new RuntimeException('out of service');
                }
            },
        );
        $events->subscribe(
            'BookingConfirmed',
            new class ($received) implements Subscriber {
                public function __construct(private ArrayObject $received) {}

                public function name(): string
                {
                    return 'FrontDesk';
                }

                public function handle(Event $event): void
                {
                    $this->received[] = $event->request->id;
                }
            },
        );
        $events->publish(new Event('BookingConfirmed', $this->request()));
        $this->assertSame(['R-1'], $received->getArrayCopy());
        $this->assertSame(
            ['BookingConfirmed R-1: Broken: out of service'],
            $events->failures,
        );
    }
}
