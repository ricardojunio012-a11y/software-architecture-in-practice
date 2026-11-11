<?php
// One withdrawal from the fund, in its own process, for the concurrency test.
// Usage: php concurrent_withdrawal.php <amount in cents> <description>
require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/fund.php';

use function Morada\{connect, recordWithdrawal};

$recorded = recordWithdrawal(
    connect(getenv('DATABASE_URL')),
    1,
    (int) $argv[1],
    $argv[2],
);
echo $recorded ? 'recorded' : 'refused';
