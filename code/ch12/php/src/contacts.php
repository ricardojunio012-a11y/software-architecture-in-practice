<?php
// Usage: php contacts.php <output-folder>
// The hard part of the extraction. To send a notice, Communications needs the
// resident's email, which belongs to the Directory and, in the monolith, came from
// a join with its table. Outside the monolith, with no shared table, there are two
// paths: query the Directory through its API on every notice, or keep a replica of
// the contacts, fed by the ContactChanged events. A simulated clock, in minutes,
// keeps the output the same on any machine.

$scenario = json_decode(file_get_contents('/data/input/contacts.json'), true);
$changes = $scenario['changes'];
$from = $scenario['directoryDown']['from'];
$to = $scenario['directoryDown']['to'];
$lag = $scenario['replicaLag'];
$outDir = $argv[1];

$unitOf = fn(int $notice) => sprintf(
    'U-%02d',
    (($notice - 1) % $scenario['units']) + 1,
);
$directoryUp = fn(int $minute) => $minute < $from || $minute > $to;

// A unit's email at a given minute, counting the changes already in effect
function emailAt(array $changes, string $unit, int $minute, int $copyLag = 0): string
{
    $email = 'resident.' . strtolower(str_replace('-', '', $unit)) . '@example.com';
    foreach ($changes as $c) {
        if ($c['unit'] === $unit && $c['minute'] + $copyLag <= $minute) {
            $email = $c['email'];
        }
    }
    return $email;
}

// Path 1: on every notice, ask the Directory for the email. If it does not answer,
// the notice waits in a local queue and goes out when the Directory comes back.
$calls = 0;
$errors = 0;
$rightAway = 0;
$longestDelay = 0;
$held = [];
for ($notice = 1; $notice <= $scenario['notices']; $notice++) {
    $minute = $notice;
    if ($directoryUp($minute)) {
        foreach ($held as $queued) {
            $calls++;
            $longestDelay = max($longestDelay, $minute - $queued);
        }
        $held = [];
    }
    $calls++;
    if (!$directoryUp($minute)) {
        $errors++;
        $held[] = $minute;
        continue;
    }
    $rightAway++;
}
$lines = [
    'Querying the Directory API on every notice',
    "  calls to the Directory: $calls ($errors failed)",
    "  notices sent right away: $rightAway",
    "  notices held until the Directory came back: $errors " .
    "(longest delay: $longestDelay min)",
    // Each lookup reads the current email: no notice goes to an old address
    '  notices sent to an outdated email: 0',
    '',
];

// Path 2: Communications keeps a copy of the contacts, loaded once and updated by
// the events, which arrive a few minutes after the change
$outdated = [];
for ($notice = 1; $notice <= $scenario['notices']; $notice++) {
    $unit = $unitOf($notice);
    if (emailAt($changes, $unit, $notice, $lag) === emailAt($changes, $unit, $notice)) {
        continue;
    }
    $ofUnit = array_filter(
        $changes,
        fn($x) => $x['unit'] === $unit && $x['minute'] <= $notice,
    );
    $c = end($ofUnit);
    $outdated[] = sprintf(
        '    E-P-%03d to %s: old email (changed at minute %d; in the replica, at %d)',
        $notice,
        $unit,
        $c['minute'],
        $c['minute'] + $lag,
    );
}
$applied = count(
    array_filter($changes, fn($c) => $c['minute'] + $lag <= $scenario['notices']),
);
array_push(
    $lines,
    "Contacts replica fed by events (lag of $lag min)",
    "  initial load: {$scenario['units']} contacts",
    "  ContactChanged events applied: $applied",
    '  calls to the Directory: 0',
    "  notices sent right away: {$scenario['notices']}",
    '  notices held until the Directory came back: 0',
    '  notices sent to an outdated email: ' . count($outdated),
    ...$outdated,
);

@mkdir("$outDir/contacts", 0777, true);
file_put_contents("$outDir/contacts/result.txt", implode("\n", $lines) . "\n");
echo "contacts: output in $outDir/contacts\n";
