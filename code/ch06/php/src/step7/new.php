<?php
// The new code: the refactored module from step 5 plus the limit rule, which was
// already born separate in step 6 (the sprout class) and so migrates without a rewrite.
namespace Morada\Step7;

require_once __DIR__ . '/../step5/bookings.php';
require_once __DIR__ . '/../step6/limit.php';

use Morada\Step5\Decision;
use Morada\Step6\MonthlyLimit;
use function Morada\Step5\{bookingAmount, declineReason};

function decide(array $data, \DateTimeImmutable $today, ?MonthlyLimit $limit = null)
{
    $limit ??= new MonthlyLimit();
    $units = array_column($data['units'], null, 'id');
    $spaces = array_column($data['spaces'], null, 'id');
    $approved = [];
    $decisions = [];
    foreach ($data['requests'] as $request) {
        $unit = $units[$request['unit']];
        $reason = declineReason($request, $unit, $today, $approved);
        if ($reason === null && $limit->reached($request, $approved)) {
            $reason = 'monthly booking limit reached';
        }
        $amount = 0;
        if ($reason === null) {
            $approved[] = $request;
            $amount = bookingAmount($spaces[$request['space']], $request);
        }
        $decisions[] = new Decision($request, $unit['email'], $reason, $amount);
    }
    return $decisions;
}
