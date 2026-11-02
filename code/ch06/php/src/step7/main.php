<?php
// Step 7: the strangler fig. A facade receives every request and decides, space by
// space, who answers: the old code (step 6) or the new one (new.php).
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
require_once __DIR__ . '/../step6/main.php';
require_once __DIR__ . '/new.php';

use function Morada\Step5\{notices, report};
use function Morada\Step6\processBookings;
use function Morada\Step7\decide;

// The route of each space. "experiment": the old code answers and the new one runs
// alongside, only to compare. With each validated slice, one space changes route; in
// the end, the old code leaves.
const ROUTES = ['party-room' => 'new', 'grill-area' => 'experiment'];

function routeOf(array $request): string
{
    return ROUTES[$request['space']] ?? 'old';
}

final class RecordingMailer
{
    public array $sent = [];

    public function send(string $to, string $text): void
    {
        $this->sent[] = "to $to: $text";
    }
}

// The old code was not made to be called like this: it takes a file and writes another.
// The facade adapts to it, through the step 2 seams, without changing a line of it.
function oldCode(array $data, DateTimeImmutable $today): array
{
    $dir = sys_get_temp_dir() . '/' . uniqid('old-');
    @mkdir($dir, 0777, true);
    file_put_contents("$dir/requests.json", json_encode($data));
    $mailer = new RecordingMailer();
    processBookings("$dir/requests.json", $dir, $today, $mailer);
    $lines = explode("\n", file_get_contents("$dir/bookings.txt"));
    $answers = [];
    foreach ($data['requests'] as $i => $r) {
        $answers[$r['id']] = [$lines[$i], $mailer->sent[$i]];
    }
    return $answers;
}

function newCode(array $data, DateTimeImmutable $today): array
{
    $decisions = decide($data, $today);
    $lines = report($decisions);
    $notices = notices($decisions);
    $answers = [];
    foreach ($decisions as $i => $d) {
        $answers[$d->request['id']] = [
            $lines[$i],
            "to {$notices[$i][0]}: {$notices[$i][1]}",
        ];
    }
    return $answers;
}

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
$data = json_decode(file_get_contents($input), true);
$only = fn(array $routes) => [
    'requests' => array_values(
        array_filter($data['requests'], fn($r) => in_array(routeOf($r), $routes)),
    ),
] + $data;
$fromOld = oldCode($only(['old', 'experiment']), $today);
$fromNew = newCode($only(['new', 'experiment']), $today);

// The experiment compares the two answers, but the old code is what answers residents
$compared = array_filter($data['requests'], fn($r) => routeOf($r) === 'experiment');
$mismatched = array_filter(
    $compared,
    fn($r) => $fromOld[$r['id']] !== $fromNew[$r['id']],
);
echo 'experiment: ' .
    count($compared) .
    ' requests compared, ' .
    count($mismatched) .
    " with differences\n";
foreach ($mismatched as $r) {
    echo "  {$r['id']}: old {$fromOld[$r['id']][0]} | new {$fromNew[$r['id']][0]}\n";
}

$answers = array_map(
    fn($r) => (routeOf($r) === 'new' ? $fromNew : $fromOld)[$r['id']],
    $data['requests'],
);
@mkdir($output, 0777, true);
file_put_contents(
    "$output/bookings.txt",
    implode("\n", array_column($answers, 0)) . "\n",
);
file_put_contents(
    "$output/emails.txt",
    implode("\n", array_column($answers, 1)) . "\n",
);
