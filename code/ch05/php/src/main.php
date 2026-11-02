<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// Assembles the objects and processes the booking requests in the order they arrived.
require_once __DIR__ . '/subscribers.php';
require_once __DIR__ . '/service.php';
require_once __DIR__ . '/race.php';

use Morada\{MinimumNotice, MonthlyLimit, SpaceAvailable, UnitInGoodStanding};
use Morada\{ChargeUsageFee, NotifyFrontDesk, NotifyResident};
use Morada\{ChannelFactory, EventBus, InMemoryRepository, SimulatedProvider};
use Morada\{BookingRequest, BookingService, Resident, Space, Unit};
use function Morada\race;

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
$data = json_decode(file_get_contents($input), true);
$spaces = [];
foreach ($data['spaces'] as $s) {
    $spaces[$s['id']] = new Space(...$s);
}
$units = [];
foreach ($data['units'] as $u) {
    $units[$u['id']] = new Unit(
        $u['id'],
        $u['inArrears'],
        new Resident(...$u['resident']),
    );
}

$buildApproval = function (InMemoryRepository $bookings) use ($today) {
    $approval = new UnitInGoodStanding();
    $approval
        ->andThen(new MinimumNotice($today))
        ->andThen(new SpaceAvailable($bookings))
        ->andThen(new MonthlyLimit($bookings));
    return $approval;
};
$bookings = new InMemoryRepository();
$approval = $buildApproval($bookings);

$provider = new SimulatedProvider(
    $data['simulatedFailures'],
    $data['invalidDestinations'],
);
[$notifications, $fees, $frontDesk, $waits] = [[], [], [], []];
// Simulated clock: records the wait instead of really waiting
$wait = function (int $ms, string $who) use (&$waits) {
    $waits[] = "$who: wait $ms ms";
};
$factory = new ChannelFactory($provider, $notifications, $wait);
$events = new EventBus();
$events->subscribe('BookingConfirmed', new ChargeUsageFee($fees));
$events->subscribe('BookingConfirmed', new NotifyFrontDesk($frontDesk));
$events->subscribe('BookingConfirmed', new NotifyResident($factory));
$events->subscribe('BookingRejected', new NotifyResident($factory));

$service = new BookingService($approval, $bookings, $events);
$decisions = [];
foreach ($data['requests'] as $r) {
    $request = new BookingRequest(
        $r['id'],
        $units[$r['unit']],
        $spaces[$r['space']],
        $r['date'],
    );
    $d = $service->submit($request);
    $result = $d->approved ? 'approved' : "rejected;{$d->reason}";
    $decisions[] = "{$r['id']};{$r['unit']};{$r['space']};{$r['date']};$result";
}

// State: canceling depends on the state the booking is in
$cancellations = [];
foreach ($data['cancellations'] as $id) {
    try {
        $cancellations[] = "$id;" . $service->cancel($id);
    } catch (\DomainException $error) {
        $cancellations[] = "$id;error;{$error->getMessage()}";
    }
}

// Now the hard part: two requests at the same time for the same space and date
$simultaneous = array_map(
    fn($r) => new BookingRequest(
        $r['id'],
        $units[$r['unit']],
        $spaces[$r['space']],
        $r['date'],
    ),
    $data['simultaneousRequests'],
);
$concurrency = race($simultaneous, function () use ($buildApproval) {
    $fresh = new InMemoryRepository();
    return [$buildApproval($fresh), $fresh];
});

$files = [
    'bookings' => $decisions,
    'notifications' => $notifications,
    'sent' => $provider->delivered,
    'fees' => $fees,
    'front-desk' => $frontDesk,
    'failures' => $events->failures,
    'waits' => $waits,
    'cancellations' => $cancellations,
    'concurrency' => $concurrency,
];
@mkdir($output, 0777, true);
foreach ($files as $name => $lines) {
    file_put_contents("$output/$name.txt", implode("\n", $lines) . "\n");
}
echo count($decisions) . " requests processed; output in $output\n";
