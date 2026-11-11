<?php
// The board president's delinquency report, with the defect the chapter uses to show
// the leak: the query forgot the community filter.
namespace Morada;

use PDO;

function delinquents(PDO $db): array
{
    return $db
        ->query(
            <<<SQL
            SELECT community_id, unit, resident, amount_cents
            FROM charges
            WHERE status = 'open' -- missing: AND community_id = ?
            ORDER BY community_id, unit
            SQL
            ,
        )
        ->fetchAll(PDO::FETCH_ASSOC);
}
