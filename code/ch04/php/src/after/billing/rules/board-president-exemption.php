<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\After\Billing\amountOf;

// The board president does not pay the monthly dues (the reserve fund still applies).
final class BoardPresidentExemption implements Rule
{
    public function apply(array $unit, array $posted): array
    {
        if (empty($unit['boardPresident'])) {
            return [];
        }
        $dues = amountOf($posted, 'dues');
        return [new Entry('exemption', 'Board president exemption', -$dues)];
    }
}
