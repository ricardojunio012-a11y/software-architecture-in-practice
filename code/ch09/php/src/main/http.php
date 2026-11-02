<?php
// Usage: php http.php memory|postgres <output-folder>
// Starts the HTTP adapter with the chosen repository, sends the requests
// in memory and writes the responses and the final state of the schedules.
require_once __DIR__ . '/assemble.php';
require_once __DIR__ . '/../adapters/inbound/http.php';

use Slim\Psr7\Factory\{ServerRequestFactory, StreamFactory};

use function Morada\Adapters\Inbound\createApi;
use function Morada\Domain\slot;

[, $repository, $output] = $argv;
[$service, $schedules] = assemble($repository, true);
$api = createApi($service);
$data = json_decode(file_get_contents('/data/input/requests.json'), true);

$lines = [];
foreach ($data['requests'] as $r) {
    $req = (new ServerRequestFactory())->createServerRequest($r['method'], $r['path']);
    parse_str(parse_url($r['path'], PHP_URL_QUERY) ?? '', $query);
    $req = $req->withQueryParams($query);
    if (isset($r['body'])) {
        $req = $req
            ->withHeader('Content-Type', 'application/json')
            ->withBody((new StreamFactory())->createStream(json_encode($r['body'])));
    }
    $response = $api->handle($req);
    $body = json_encode(
        json_decode((string) $response->getBody()),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
    );
    $lines[] = "{$r['method']} {$r['path']} -> {$response->getStatusCode()} $body";
}
$state = [];
foreach ($schedules->all() as $s) {
    foreach ($s->bookings() as $b) {
        $state[] = "{$s->space->id};{$b->id};{$b->unit};" . slot($b);
    }
}

@mkdir($output, 0777, true);
file_put_contents("$output/responses.txt", implode("\n", $lines) . "\n");
file_put_contents("$output/schedules.txt", implode("\n", $state) . "\n");
echo count($lines) . " requests ($repository); output in $output\n";
