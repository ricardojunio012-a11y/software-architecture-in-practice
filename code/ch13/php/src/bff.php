<?php
// The Backend for Frontend of the front-desk staff app. It belongs to the app team and
// speaks the language of the screen: it gathers in one call what the tablet needs and
// receives the operations made offline, in a batch, applying each one only once.
namespace Morada;

require_once __DIR__ . '/backend.php';

final class StaffBff
{
    public int $repeated = 0;

    // Without the third argument, the results live only in this process's memory
    public function __construct(
        private readonly FrontDesk $frontDesk,
        private readonly Bookings $bookings,
        private \ArrayObject $results = new \ArrayObject(),
    ) {}

    // The whole home screen in one call, with only the fields the tablet shows
    public function home(): array
    {
        $pending = [];
        foreach ($this->frontDesk->packages as $p) {
            if ($p['status'] === 'at front desk') {
                $pending[] = [
                    'id' => $p['id'],
                    'unit' => $p['unit'],
                    'version' => $p['version'],
                ];
            }
        }
        // Compares name and booking field by field: "Anna" must not match "Mary Anna"
        $entered = function (array $g): bool {
            foreach ($this->frontDesk->visitors as $v) {
                if ($v['name'] === $g['name'] && $v['booking'] === $g['booking']) {
                    return true;
                }
            }
            return false;
        };
        $expected = array_values(
            array_filter($this->bookings->guests(), fn($g) => !$entered($g)),
        );
        return [
            'pendingPackages' => $pending,
            'expectedVisitors' => $expected,
        ];
    }

    // Idempotent by operation id: a resent batch applies nothing twice
    public function sync(string $tablet, array $operations): array
    {
        $output = [];
        foreach ($operations as $op) {
            if (isset($this->results[$op['id']])) {
                $this->repeated++;
                $output[] = [$op, $this->results[$op['id']]];
                continue;
            }
            $result =
                $op['type'] === 'registerVisitor'
                    ? $this->frontDesk->registerVisitor(
                        $op['name'],
                        $op['booking'],
                        $tablet,
                        $op['time'],
                    )
                    : $this->frontDesk->change(
                        $op['packageId'],
                        $op['type'] === 'deliver' ? 'delivered' : 'returned',
                        $op['seenVersion'],
                        $tablet,
                        $op['time'],
                    );
            $this->results[$op['id']] = $result;
            $output[] = [$op, $result];
        }
        return $output;
    }
}
