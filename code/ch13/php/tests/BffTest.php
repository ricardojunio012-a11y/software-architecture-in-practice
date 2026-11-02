<?php
// Tests: the home screen in one call, the idempotent batch, and the detected conflict.
require_once __DIR__ . '/../src/bff.php';

use Morada\{StaffBff, FrontDesk, Bookings};
use PHPUnit\Framework\TestCase;

final class BffTest extends TestCase
{
    private const DELIVER = [
        'id' => 'op-A1',
        'type' => 'deliver',
        'packageId' => 'P-1',
        'seenVersion' => 1,
        'time' => '09:00',
    ];

    private function build(): StaffBff
    {
        return new StaffBff(
            new FrontDesk([['id' => 'P-1', 'unit' => 'A-1']]),
            new Bookings([
                ['booking' => 'R-1', 'space' => 'party-room', 'names' => ['Anna']],
            ]),
        );
    }

    public function testBuildsTheHomeScreenInOneCall(): void
    {
        $screen = $this->build()->home();
        $this->assertSame('P-1', $screen['pendingPackages'][0]['id']);
        $this->assertSame('Anna', $screen['expectedVisitors'][0]['name']);
    }

    public function testDoesNotMistakeAVisitorForAnotherWhoseNameContainsTheirs(): void
    {
        $bff = new StaffBff(
            new FrontDesk([]),
            new Bookings([
                [
                    'booking' => 'R-1',
                    'space' => 'party-room',
                    'names' => ['Anna', 'Mary Anna'],
                ],
            ]),
        );
        $bff->sync('A', [
            [
                'id' => 'op-A1',
                'type' => 'registerVisitor',
                'name' => 'Mary Anna',
                'booking' => 'R-1',
                'time' => '09:00',
            ],
        ]);
        $expected = array_column($bff->home()['expectedVisitors'], 'name');
        $this->assertSame(['Anna'], $expected);
    }

    public function testWithPersistedResultsRecognizesTheBatchAfterARestart(): void
    {
        $frontDesk = new FrontDesk([['id' => 'P-1', 'unit' => 'A-1']]);
        $bookings = new Bookings([]);
        $table = new ArrayObject();
        (new StaffBff($frontDesk, $bookings, $table))->sync('A', [self::DELIVER]);
        $after = new StaffBff($frontDesk, $bookings, $table);
        [[, $result]] = $after->sync('A', [self::DELIVER]);
        $this->assertSame('applied', $result);
        $this->assertSame(1, $after->repeated);
    }

    public function testDoesNotApplyAResentBatchTwice(): void
    {
        $bff = $this->build();
        $bff->sync('A', [self::DELIVER]);
        [[, $result]] = $bff->sync('A', [self::DELIVER]);
        $this->assertSame('applied', $result);
        $this->assertSame(1, $bff->repeated);
    }

    public function testReportsAConflictWhenThePackageChanged(): void
    {
        $bff = $this->build();
        $bff->sync('B', [['id' => 'op-B1', 'type' => 'return'] + self::DELIVER]);
        [[, $result]] = $bff->sync('A', [self::DELIVER]);
        $this->assertSame(
            'conflict: P-1 already returned by tablet B at 09:00',
            $result,
        );
    }
}
