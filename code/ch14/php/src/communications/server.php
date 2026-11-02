<?php
// Router for PHP's built-in HTTP server, serving the real API with the notices in
// PostgreSQL. Used by the end-to-end test.
require_once __DIR__ . '/api.php';
require_once __DIR__ . '/postgres.php';

use Morada\Communications\{Communications, PostgresNotices};

use function Morada\Communications\handle;

$communications = new Communications(
    PostgresNotices::connect(getenv('DATABASE_URL'), false),
);
[$status, $body] = handle(
    $communications,
    $_SERVER['REQUEST_METHOD'],
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    file_get_contents('php://input'),
);
http_response_code($status);
header('Content-Type: application/json');
echo json_encode($body, JSON_UNESCAPED_UNICODE);
