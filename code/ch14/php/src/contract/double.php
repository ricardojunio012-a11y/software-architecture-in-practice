<?php
// The provider double, as a router for PHP's HTTP server: checks the request and
// returns the response of the current interaction, which the consumer writes to a
// file.
$current = json_decode(file_get_contents('/tmp/current-interaction.json'), true);
$expected = $current['request'];
$same =
    $_SERVER['REQUEST_METHOD'] === $expected['method'] &&
    $_SERVER['REQUEST_URI'] === $expected['path'] &&
    json_decode(file_get_contents('php://input'), true) === $expected['body'];
http_response_code($same ? $current['response']['status'] : 500);
header('Content-Type: application/json');
echo json_encode(
    $same ? $current['response']['body'] : ['error' => 'unexpected request'],
    JSON_UNESCAPED_UNICODE,
);
