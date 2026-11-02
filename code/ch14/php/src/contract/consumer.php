<?php
// Consumer-side contract test. A test double answers exactly what each interaction
// promises; the monolith's real client talks to it. If the client understands every
// response, the interactions become the published contract.
require_once __DIR__ . '/interactions.php';
require_once __DIR__ . '/../communications/api.php';
require_once __DIR__ . '/../monolith/client.php';

use Morada\Monolith\CommunicationsClient;

use const Morada\Contract\INTERACTIONS;

use function Morada\Communications\start;
use function Morada\Contract\json;

$outDir = $argv[1];
$double = start(__DIR__ . '/double.php', 8091);
$client = new CommunicationsClient('http://127.0.0.1:8091');

// What the monolith must understand from each response
$expected = [
    'sending a new notice' => ['ok' => true, 'duplicate' => false],
    'resending a notice already sent' => ['ok' => true, 'duplicate' => true],
    'notice without text' => ['ok' => false, 'error' => 'text is required'],
];

$report = [];
foreach (INTERACTIONS as $interaction) {
    file_put_contents('/tmp/current-interaction.json', json_encode($interaction));
    $body = $interaction['request']['body'];
    $result = $client->send($body['id'], $body['text']);
    $ok = $result === $expected[$interaction['description']];
    $report[] =
        "{$interaction['description']}: " . ($ok ? 'the client understood' : 'FAILED');
}
proc_terminate($double);

$contract = [
    'consumer' => 'monolith',
    'provider' => 'communications',
    'interactions' => INTERACTIONS,
];
@mkdir("$outDir/consumer", 0777, true);
file_put_contents("$outDir/consumer/contract.json", json($contract) . "\n");
file_put_contents("$outDir/consumer/report.txt", implode("\n", $report) . "\n");
echo 'consumer: ' . count(INTERACTIONS) . " interactions in the contract\n";
