<?php
// Simulation of the batch invoice queue at the payment processor ("now the hard part").
// Simulated clock and a fixed-seed random draw: the same output on any machine.
// The numbers in batch.json are lab assumptions, not those of a real processor.
namespace Morada\Batch;

final class Result
{
    public int $files = 0;
    public int $attempts = 0;
    /** @var array<int,int> simulation second => how many invoices */
    public array $availableAt = [];
    public int $notCreated = 0; // never became available
    public int $viaCard = 0; // got card payment instead of the invoice
}

// Park-Miller congruential generator: integers only, the same in all four languages
function generator(int $seed): \Closure
{
    $x = $seed;
    return function () use (&$x): int {
        $x = ($x * 48271) % 2147483647;
        return $x;
    };
}

// naive: resends every rejection and notifies the resident only with a created invoice.
// adjusted: a permanent rejection does not go back to the queue, and an invoice with no
// time left to be confirmed switches to card payment (the ADR-002 alternative).
function simulate(array $p, bool $adjusted): Result
{
    $draw = generator($p['seed']);
    $queue = []; // [sentAt, order, invoices, attempt]
    for ($i = 0; $i < $p['invoices']; $i += $p['invoicesPerFile']) {
        $end = min($p['invoices'], $i + $p['invoicesPerFile']);
        $queue[] = [0, count($queue), range($i, $end - 1), 1];
    }
    $r = new Result();
    $order = count($queue);
    $processorFree = 0;
    $throughput = $p['invoicesPerSecond'];
    while ($queue) {
        // The processor handles one file at a time, in order of arrival
        $i = 0;
        foreach ($queue as $k => $a) {
            if ([$a[0], $a[1]] < [$queue[$i][0], $queue[$i][1]]) {
                $i = $k;
            }
        }
        [$sentAt, , $invoices, $attempt] = $queue[$i];
        array_splice($queue, $i, 1);
        $r->files++;
        $r->attempts += count($invoices);
        $start = max($sentAt, $processorFree);
        $processorFree =
            $start + intdiv(count($invoices) + $throughput - 1, $throughput);
        $returnAt = $processorFree + $p['returnSeconds'];
        $resend = [];
        foreach ($invoices as $inv) {
            $permanent = $inv % $p['permanentRejectionEvery'] === 0;
            $rejected = $permanent || $draw() % 100 < $p['transientFailurePercent'];
            if (!$rejected) {
                $r->availableAt[$returnAt] = ($r->availableAt[$returnAt] ?? 0) + 1;
            } elseif (!$adjusted) {
                if ($attempt < $p['maxAttempts']) {
                    $resend[] = $inv;
                } else {
                    $r->notCreated++;
                }
            } elseif (
                $permanent ||
                $attempt >= $p['maxAttempts'] ||
                $returnAt + $p['returnSeconds'] > $p['limitSeconds']
            ) {
                // the notice goes out with card payment, no new cycle
                $r->availableAt[$returnAt] = ($r->availableAt[$returnAt] ?? 0) + 1;
                $r->viaCard++;
            } else {
                $resend[] = $inv;
            }
        }
        if ($resend) {
            $queue[] = [$returnAt, $order++, $resend, $attempt + 1];
        }
    }
    return $r;
}

// Nearest-rank percentile, in thousandths (990 = p99, 999 = p99.9).
// Returns null when it falls on the invoices that never became available.
function percentile(Result $r, int $total, int $thousandths): ?int
{
    $rank = intdiv($thousandths * $total + 999, 1000);
    $times = $r->availableAt;
    ksort($times);
    $cumulative = 0;
    foreach ($times as $t => $n) {
        $cumulative += $n;
        if ($cumulative >= $rank) {
            return $t;
        }
    }
    return null;
}

function availableBy(Result $r, int $limit): int
{
    $sum = 0;
    foreach ($r->availableAt as $t => $n) {
        if ($t <= $limit) {
            $sum += $n;
        }
    }
    return $sum;
}
