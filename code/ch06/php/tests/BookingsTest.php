<?php
// Characterization tests: they describe what the code does today, including what
// may be wrong. Changing the behavior is another step, with another commit.
require_once __DIR__ . '/../src/step5/bookings.php';

use PHPUnit\Framework\TestCase;
use function Morada\Step5\{bookingAmount, decide, declineReason, notices, report};

final class BookingsTest extends TestCase
{
    // Input and approved result: /data in the container; outside it, the chapter folder
    private function read(string $folder, string $file): string
    {
        $base = is_dir("/data/$folder") ? "/data/$folder" : __DIR__ . "/../../$folder";
        return file_get_contents("$base/$file");
    }

    private function today(): DateTimeImmutable
    {
        return new DateTimeImmutable('2026-03-02', new DateTimeZone('UTC'));
    }

    public function testTheOutputIsIdenticalToTheApprovedResult(): void
    {
        $data = json_decode($this->read('input', 'bookings.json'), true);
        $decisions = decide($data, $this->today());
        $emails = array_map(fn($n) => "to {$n[0]}: {$n[1]}", notices($decisions));
        $this->assertSame(
            $this->read('expected', 'bookings.txt'),
            implode("\n", report($decisions)) . "\n",
        );
        $this->assertSame(
            $this->read('expected', 'emails.txt'),
            implode("\n", $emails) . "\n",
        );
    }

    public function testSundayHasNoWeekendSurchargeCurrentBehavior(): void
    {
        $partyRoom = ['id' => 'party-room', 'name' => 'Party room', 'fee' => 15000];
        $sunday = [
            'id' => 'R',
            'space' => 'party-room',
            'date' => '2026-03-15',
            'guests' => 1,
        ];
        $this->assertSame(15000, bookingAmount($partyRoom, $sunday));
        $this->assertSame(
            18000,
            bookingAmount($partyRoom, ['date' => '2026-03-14'] + $sunday),
        );
    }

    public function testTheFirstRuleThatFailsDecidesTheReason(): void
    {
        $request = ['id' => 'R', 'space' => 'party-room', 'date' => '2026-03-03'];
        $inArrears = ['id' => 'A', 'email' => 'a@x.com', 'inArrears' => true];
        $this->assertSame(
            'arrears',
            declineReason($request, $inArrears, $this->today(), []),
        );
        $upToDate = ['inArrears' => false] + $inArrears;
        $this->assertSame(
            'short notice',
            declineReason($request, $upToDate, $this->today(), []),
        );
    }
}
