<?php
// Usage: php main.php <requests.json> <output-folder>
// Assembles the layers from the bottom up and sends the requests to the API, in memory
// (without opening a port), writing each response.
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/presentation/api.php';

use Morada\Layers\Application\BookingService;
use Morada\Layers\Data\ScheduleRepository;
use Morada\Layers\Domain\Space;
use Slim\Psr7\Factory\{ServerRequestFactory, StreamFactory};

use function Morada\Layers\Presentation\createApi;

[, $input, $output] = $argv;
$data = json_decode(file_get_contents($input), true);
$spaces = array_map(
    fn($s) => new Space($s['id'], $s['feeCents'], $s['minNoticeDays']),
    $data['spaces'],
);
$api = createApi(new BookingService(new ScheduleRepository($spaces)));

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
        JSON_UNESCAPED_UNICODE,
    );
    $lines[] = "{$r['method']} {$r['path']} -> {$response->getStatusCode()} $body";
}
@mkdir($output, 0777, true);
file_put_contents("$output/responses.txt", implode("\n", $lines) . "\n");
echo count($lines) . " requests; output in $output\n";
