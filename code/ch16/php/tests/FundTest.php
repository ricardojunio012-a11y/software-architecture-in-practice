<?php
// The reserve fund: formatting in dollars, and two simultaneous withdrawals with the
// fund row locked, which never leave the balance negative. PHP has no threads, so
// each withdrawal runs in a separate process (concurrent_withdrawal.php).
require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/fund.php';
require_once __DIR__ . '/../src/migrations.php';

use PHPUnit\Framework\TestCase;

use function Morada\{
    applyMigrations,
    balance,
    connect,
    dollars,
    resetSchema,
    setUpFund,
};

final class FundTest extends TestCase
{
    public function testDollarsFormatsCentsWithThousandsSeparatorAndSign(): void
    {
        $this->assertSame('$1,000.00', dollars(100000));
        $this->assertSame('-$300.00', dollars(-30000));
        $this->assertSame('$0.05', dollars(5));
    }

    public function testSimultaneousWithdrawalsWithTheFundLockedNeverGoNegative(): void
    {
        if (!getenv('DATABASE_URL')) {
            $this->markTestSkipped('no database');
        }
        $db = connect(getenv('DATABASE_URL'));
        resetSchema($db);
        applyMigrations($db, '/data/migrations');
        setUpFund($db);
        $processes = [];
        $outputs = [];
        foreach (
            [[70000, 'gate repair'], [60000, 'facade painting']]
            as [$amount, $reason]
        ) {
            $command = [
                'php',
                __DIR__ . '/concurrent_withdrawal.php',
                (string) $amount,
                $reason,
            ];
            $processes[] = proc_open($command, [1 => ['pipe', 'w']], $pipes);
            $outputs[] = $pipes[1];
        }
        $results = array_map(fn($pipe) => trim(stream_get_contents($pipe)), $outputs);
        array_map('proc_close', $processes);
        $this->assertSame(1, count(array_keys($results, 'recorded')));
        $this->assertGreaterThanOrEqual(0, balance($db, 1));
    }
}
