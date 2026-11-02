<?php
// Usage: php cli.php <command> [arguments]   (repository in PostgreSQL)
//        php cli.php prepare-db              (drops and recreates the table)
// Each run is a new process: the state stays in the database between runs.
require_once __DIR__ . '/assemble.php';
require_once __DIR__ . '/../adapters/inbound/cli.php';

use function Morada\Adapters\Inbound\execute;

$args = array_slice($argv, 1);
$prepare = ($args[0] ?? '') === 'prepare-db';
[$service] = assemble('postgres', $prepare);
[$text, $code] = $prepare ? ['database ready', 0] : execute($service, $args);
echo $text . "\n";
exit($code);
