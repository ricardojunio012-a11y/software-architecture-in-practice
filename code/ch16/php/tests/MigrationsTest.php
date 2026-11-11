<?php
// The migrations run once each, in order, and a second run does nothing.
require_once __DIR__ . '/../src/db.php';
require_once __DIR__ . '/../src/migrations.php';

use PHPUnit\Framework\TestCase;

use function Morada\{applyMigrations, connect, resetSchema};

final class MigrationsTest extends TestCase
{
    public function testApplyEachFileOnlyOnceInOrder(): void
    {
        if (!getenv('DATABASE_URL')) {
            $this->markTestSkipped('no database');
        }
        $db = connect(getenv('DATABASE_URL'));
        resetSchema($db);
        $this->assertSame(
            ['001_charges.sql', '002_reserve_fund.sql', '003_delinquency_index.sql'],
            applyMigrations($db, '/data/migrations'),
        );
        $this->assertSame([], applyMigrations($db, '/data/migrations'));
    }
}
