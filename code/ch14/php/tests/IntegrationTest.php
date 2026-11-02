<?php
// Integration tests: the repository against a real PostgreSQL, in a container.
require_once __DIR__ . '/../src/communications/postgres.php';

use Morada\Communications\PostgresNotices;
use PHPUnit\Framework\TestCase;

final class IntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        if (!getenv('DATABASE_URL')) {
            $this->markTestSkipped('no database');
        }
    }

    public function testRecordsANoticeAndFindsItLater(): void
    {
        $notices = PostgresNotices::connect(getenv('DATABASE_URL'));
        $this->assertFalse($notices->alreadySent('E-1'));
        $notices->record('E-1', 'payment received');
        $this->assertTrue($notices->alreadySent('E-1'));
    }

    public function testTheDatabaseRejectsTheSameNoticeTwice(): void
    {
        $notices = PostgresNotices::connect(getenv('DATABASE_URL'));
        $notices->record('E-1', 'payment received');
        $this->expectException(PDOException::class);
        $notices->record('E-1', 'payment received');
    }
}
