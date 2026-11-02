<?php
// End-to-end test: the monolith's client, the real API and PostgreSQL together.
// Few, slow and valuable: they prove the pieces were wired correctly.
require_once __DIR__ . '/../src/communications/api.php';
require_once __DIR__ . '/../src/communications/postgres.php';
require_once __DIR__ . '/../src/monolith/client.php';

use Morada\Communications\PostgresNotices;
use Morada\Monolith\CommunicationsClient;
use PHPUnit\Framework\TestCase;

use function Morada\Communications\start;

final class EndToEndTest extends TestCase
{
    public function testSendsTheNoticeOnceAndRecognizesTheResend(): void
    {
        if (!getenv('DATABASE_URL')) {
            $this->markTestSkipped('no database');
        }
        PostgresNotices::connect(getenv('DATABASE_URL'));
        $api = start(__DIR__ . '/../src/communications/server.php', 8092);
        $client = new CommunicationsClient('http://127.0.0.1:8092');
        $first = $client->send('E-1', 'payment received');
        $second = $client->send('E-1', 'payment received');
        proc_terminate($api);
        $this->assertSame(['ok' => true, 'duplicate' => false], $first);
        $this->assertSame(['ok' => true, 'duplicate' => true], $second);
    }
}
