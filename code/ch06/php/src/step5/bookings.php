<?php
// Bookings module. Step 5: separate phases (Split Phase) and no global state.
// decide() calculates; report() and notices() format; main reads and writes.
namespace Morada\Step5;

const MIN_NOTICE_DAYS = 2;
const SATURDAY_SURCHARGE_PERCENT = 20;
const GUEST_LIMIT = 50;
const EXTRA_CLEANING_FEE = 5000; // cents

final readonly class Decision
{
    public function __construct(
        public array $request,
        public string $email,
        public ?string $reason,
        public int $amount,
    ) {}
}

function daysUntil(string $isoDate, \DateTimeImmutable $today): int
{
    $date = new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC'));
    return intdiv($date->getTimestamp() - $today->getTimestamp(), 86400);
}

// The original comment said "weekend", but the code only checks Saturday
function isSaturday(string $isoDate): bool
{
    return (new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC')))->format('w') ===
        '6';
}

function bookingAmount(array $space, array $request): int
{
    $amount = $space['fee'];
    if (isSaturday($request['date'])) {
        $amount += intdiv($amount * SATURDAY_SURCHARGE_PERCENT, 100);
    }
    if ($request['guests'] > GUEST_LIMIT) {
        $amount += EXTRA_CLEANING_FEE;
    }
    return $amount;
}

function declineReason(
    array $request,
    array $unit,
    \DateTimeImmutable $today,
    array $approved,
): ?string {
    if ($unit['inArrears']) {
        return 'arrears';
    }
    if (daysUntil($request['date'], $today) < MIN_NOTICE_DAYS) {
        return 'short notice';
    }
    foreach ($approved as $b) {
        if ($b['space'] === $request['space'] && $b['date'] === $request['date']) {
            return 'conflict';
        }
    }
    return null;
}

// Phase 1: decide each request, in order. The approved list is now local.
function decide(array $data, \DateTimeImmutable $today): array
{
    $units = array_column($data['units'], null, 'id');
    $spaces = array_column($data['spaces'], null, 'id');
    $approved = [];
    $decisions = [];
    foreach ($data['requests'] as $request) {
        $unit = $units[$request['unit']];
        $reason = declineReason($request, $unit, $today, $approved);
        $amount = 0;
        if ($reason === null) {
            $approved[] = $request;
            $amount = bookingAmount($spaces[$request['space']], $request);
        }
        $decisions[] = new Decision($request, $unit['email'], $reason, $amount);
    }
    return $decisions;
}

function dollars(int $cents): string
{
    return intdiv($cents, 100) . '.' . sprintf('%02d', $cents % 100);
}

// Phase 2: format the report and the notices from the decisions
function report(array $decisions): array
{
    return array_map(function (Decision $d) {
        $r = $d->request;
        $head = "{$r['id']};{$r['unit']};{$r['space']};{$r['date']}";
        return $d->reason !== null
            ? "$head;declined;{$d->reason}"
            : "$head;approved;" . dollars($d->amount);
    }, $decisions);
}

function notices(array $decisions): array
{
    return array_map(
        fn(Decision $d) => [
            $d->email,
            $d->reason !== null
                ? "Booking {$d->request['id']} declined ({$d->reason})"
                : "Booking {$d->request['id']} confirmed. Amount: $" .
                    dollars($d->amount),
        ],
        $decisions,
    );
}
