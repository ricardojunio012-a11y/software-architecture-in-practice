<?php
// Contract tests. The first one is the test that breaks the build when someone
// changes openapi/v1.yaml in a way that current clients cannot handle.
require_once __DIR__ . '/../src/contract/compatibility.php';
require_once __DIR__ . '/../src/contract/validate.php';

use PHPUnit\Framework\TestCase;

use function Morada\Contract\{compareContracts, readContract, validateResponse};

final class ContractTest extends TestCase
{
    private static function breaks(array $old, array $proposed): array
    {
        $incompatible = array_filter(
            compareContracts($old, $proposed),
            fn($c) => !$c->compatible,
        );
        return array_values(array_map(fn($c) => $c->text, $incompatible));
    }

    public function testTheCurrentContractIsCompatibleWithThePublishedOne(): void
    {
        $published = readContract('/data/openapi/published/v1.yaml');
        $current = readContract('/data/openapi/v1.yaml');
        $this->assertSame([], self::breaks($published, $current));
    }

    public function testRenamingAResponseFieldIsIncompatible(): void
    {
        $published = readContract('/data/openapi/published/v1.yaml');
        $proposal = readContract('/data/input/proposals/b-rename.yaml');
        $this->assertSame(
            [
                'GET /v1/communities/{community}/charges 200: ' .
                'field removed: data[].amountCents',
            ],
            self::breaks($published, $proposal),
        );
    }

    public function testAResponseWithTheWrongTypeFailsTheCheck(): void
    {
        $body = json_decode(
            json_encode([
                'data' => [
                    [
                        'id' => 'CH-02',
                        'unit' => '102',
                        'dueDate' => '2026-10-10',
                        'amountCents' => '450.00',
                        'status' => 'open',
                    ],
                ],
                'next' => null,
            ]),
        );
        $current = readContract('/data/openapi/v1.yaml');
        $path = '/v1/communities/C-01/charges';
        $this->assertSame(
            [
                'GET /v1/communities/{community}/charges 200: ' .
                '$.data[0].amountCents: expected integer, got string',
            ],
            validateResponse($current, 'GET', $path, 200, 'application/json', $body),
        );
    }
}
