<?php
// Integration tests of idempotency against PostgreSQL: five simultaneous requests
// with the same key result in a single payment, and all of them get the same
// response; the same key at two management companies is two different requests. The
// API must be up at API_URL (run.sh starts it with several processes).
require_once __DIR__ . '/../src/api/api.php';

use PHPUnit\Framework\TestCase;

use function Morada\Api\{connect, prepareDatabase};

final class IdempotencyTest extends TestCase
{
    protected function setUp(): void
    {
        if (!getenv('DATABASE_URL') || !getenv('API_URL')) {
            $this->markTestSkipped('no database or no API');
        }
        prepareDatabase(getenv('DATABASE_URL'), '/data/input/charges.json');
    }

    private function request(string $company, string $charge, int $amount)
    {
        $curl = curl_init(getenv('API_URL') . '/v1/payments');
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                "Morada-Management-Company: $company",
                'Idempotency-Key: k-1',
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'charge' => $charge,
                'amountCents' => $amount,
            ]),
            CURLOPT_RETURNTRANSFER => true,
        ]);
        return $curl;
    }

    private function totalPayments(): int
    {
        return connect(getenv('DATABASE_URL'))
            ->query('SELECT count(*) FROM payments')
            ->fetchColumn();
    }

    public function testSimultaneousRequestsWithTheSameKeyPayOnlyOnce(): void
    {
        $all = curl_multi_init();
        $requests = [];
        for ($i = 0; $i < 5; $i++) {
            $curl = $this->request('MC-A', 'CH-04', 45000);
            curl_multi_add_handle($all, $curl);
            $requests[] = $curl;
        }
        do {
            curl_multi_exec($all, $active);
            curl_multi_select($all);
        } while ($active > 0);
        $status = array_map(
            fn($c) => curl_getinfo($c, CURLINFO_RESPONSE_CODE),
            $requests,
        );
        $ids = array_map(
            fn($c) => json_decode(curl_multi_getcontent($c), true)['id'],
            $requests,
        );
        $this->assertSame([201, 201, 201, 201, 201], $status);
        $this->assertCount(1, array_unique($ids));
        $this->assertSame(1, $this->totalPayments());
    }

    public function testTheSameKeyAtTwoManagementCompaniesDoesNotCollide(): void
    {
        $a = $this->request('MC-A', 'CH-04', 45000);
        $bodyA = json_decode(curl_exec($a), true);
        $b = $this->request('MC-B', 'CH-05', 38000);
        $bodyB = json_decode(curl_exec($b), true);
        $status = [
            curl_getinfo($a, CURLINFO_RESPONSE_CODE),
            curl_getinfo($b, CURLINFO_RESPONSE_CODE),
        ];
        $this->assertSame([201, 201], $status);
        $this->assertSame('CH-04', $bodyA['charge']);
        $this->assertSame('CH-05', $bodyB['charge']);
        $this->assertSame(2, $this->totalPayments());
    }
}
