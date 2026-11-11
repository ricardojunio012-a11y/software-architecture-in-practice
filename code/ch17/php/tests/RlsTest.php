<?php
// Row-Level Security in PostgreSQL: a query with no filter sees only the
// transaction's community, and writing to another community is rejected. The
// management company sees the communities it manages, and only those.
require_once __DIR__ . '/../src/db.php';

use PHPUnit\Framework\TestCase;

use function Morada\{asCommunity, asManagementCompany, connect};

final class RlsTest extends TestCase
{
    public function testIsolatesReadsAndWritesByCommunity(): void
    {
        if (!getenv('DATABASE_URL')) {
            $this->markTestSkipped('no database');
        }
        $admin = connect(getenv('DATABASE_URL'));
        $admin->exec(file_get_contents('/data/sql/schema.sql'));
        $admin->exec(file_get_contents('/data/sql/rls.sql'));
        $app = connect(getenv('APP_DATABASE_URL'));
        $communities = asCommunity(
            $app,
            15,
            fn() => $app
                ->query('SELECT DISTINCT community_id FROM charges')
                ->fetchAll(PDO::FETCH_COLUMN),
        );
        $this->assertSame([15], $communities);
        $this->expectException(PDOException::class);
        $this->expectExceptionCode('42501');
        asCommunity(
            $app,
            15,
            fn() => $app->exec(
                'INSERT INTO charges (community_id, unit, resident, amount_cents, status) ' .
                    "VALUES (20, 'B-1', 'Iris Moore', 61000, 'open')",
            ),
        );
    }

    public function testAManagementCompanySeesOnlyTheCommunitiesItManages(): void
    {
        if (!getenv('DATABASE_URL')) {
            $this->markTestSkipped('no database');
        }
        $admin = connect(getenv('DATABASE_URL'));
        $admin->exec(file_get_contents('/data/sql/schema.sql'));
        $admin->exec(file_get_contents('/data/sql/rls.sql'));
        $app = connect(getenv('APP_DATABASE_URL'));
        $communities = asManagementCompany(
            $app,
            3,
            fn() => $app
                ->query('SELECT DISTINCT community_id FROM charges ORDER BY 1')
                ->fetchAll(PDO::FETCH_COLUMN),
        );
        $this->assertSame([12, 15], $communities);
    }
}
