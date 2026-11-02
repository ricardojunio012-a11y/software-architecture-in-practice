<?php
// Command-line inbound adapter: the same use cases, driven by arguments and answered
// in text for a person to read at the terminal.
namespace Morada\Adapters\Inbound;

require_once __DIR__ . '/../../application/ports.php';

use Morada\Application\BookingUseCases;

const BOOK_USAGE = 'usage: book <booking> <unit> <space> <date> <start> <end> <today>';

// Returns the text to show and the process exit code (0 = success)
function execute(BookingUseCases $bookings, array $args): array
{
    $command = $args[0] ?? '';
    $rest = array_slice($args, 1);
    try {
        switch ($command) {
            case 'spaces':
                $lines = array_map(
                    fn($s) => "{$s['id']}: fee {$s['fee']}, notice of " .
                        "{$s['minNoticeDays']} day(s)",
                    $bookings->listSpaces(),
                );
                return [implode("\n", $lines), 0];
            case 'book':
                if (count($rest) !== 7) {
                    return [BOOK_USAGE, 2];
                }
                [$booking, $unit, $space, $date, $start, $end, $requestedOn] = $rest;
                $c = $bookings->book([
                    'booking' => $booking,
                    'unit' => $unit,
                    'space' => $space,
                    'date' => $date,
                    'start' => (int) $start,
                    'end' => (int) $end,
                    'requestedOn' => $requestedOn,
                ]);
                return ["{$c['booking']} confirmed, fee {$c['fee']}", 0];
            case 'cancel':
                $c = $bookings->cancel($rest[0], $rest[1]);
                $fee = $c['cancellationFee'];
                return ["{$c['booking']} canceled, cancellation fee $fee", 0];
            case 'bookings':
                $list = $bookings->bookingsForSpace($rest[0]);
                if (!$list) {
                    return ['no bookings', 0];
                }
                $lines = array_map(
                    fn($b) => "{$b['booking']} {$b['unit']} {$b['slot']}",
                    $list,
                );
                return [implode("\n", $lines), 0];
            default:
                return ['commands: spaces, book, cancel, bookings', 2];
        }
    } catch (\Throwable $error) {
        return ["error: {$error->getMessage()}", 1];
    }
}
