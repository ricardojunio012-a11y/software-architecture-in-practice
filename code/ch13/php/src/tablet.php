<?php
// The front-desk staff app, on the tablet. Offline, it keeps the operations in a local
// queue and keeps working; on reconnect, it sends the queue to the BFF and shows the
// conflicts.
namespace Morada;

require_once __DIR__ . '/bff.php';

final class Tablet
{
    private array $versions = [];
    private array $queue = [];
    private bool $online = true;
    private int $counter = 0;

    public function __construct(
        private readonly string $name,
        private readonly \Closure $connect,
        private array &$log,
    ) {}

    // The tablet talks to the BFF's address, whatever process is serving it
    private function bff(): StaffBff
    {
        return ($this->connect)();
    }

    private function note(string $text): void
    {
        $this->log[] = "tablet {$this->name} $text";
    }

    public function open(): void
    {
        $screen = $this->bff()->home();
        foreach ($screen['pendingPackages'] as $p) {
            $this->versions[$p['id']] = $p['version'];
        }
        $pending = implode(', ', array_column($screen['pendingPackages'], 'id'));
        $expected = implode(', ', array_column($screen['expectedVisitors'], 'name'));
        $this->note("opened: packages [$pending], expected visitors [$expected]");
    }

    public function disconnect(): void
    {
        $this->online = false;
        $this->note('lost the internet');
    }

    public function operate(array $op): void
    {
        $this->counter++;
        $op = ['id' => "op-{$this->name}{$this->counter}"] + $op;
        if (isset($op['packageId'])) {
            $op['seenVersion'] = $this->versions[$op['packageId']];
        }
        if (!$this->online) {
            $this->queue[] = $op;
            $this->note("stored {$this->describe($op)} in the local queue");
            return;
        }
        [[, $result]] = $this->bff()->sync($this->name, [$op]);
        $this->note("sent {$this->describe($op)}: $result");
    }

    // On reconnect, the queue goes as a batch, and the response may be lost on the way
    public function reconnect(bool $loseResponse): void
    {
        $this->online = true;
        $results = $this->bff()->sync($this->name, $this->queue);
        if ($loseResponse) {
            $n = count($this->queue);
            $this->note("came back and sent $n operations; the response was lost");
            return;
        }
        $this->show('sent', $results);
    }

    // Without a response, the tablet does not know what was applied: it resends the batch
    public function resend(): void
    {
        $this->show('resent', $this->bff()->sync($this->name, $this->queue));
    }

    private function show(string $verb, array $results): void
    {
        $n = count($this->queue);
        $this->note("$verb $n operations:");
        foreach ($results as [$op, $result]) {
            $this->log[] = "  {$this->describe($op)}: $result";
        }
        $this->queue = [];
    }

    private function describe(array $op): string
    {
        $target = $op['packageId'] ?? $op['name'];
        return "{$op['id']} ({$op['type']} $target)";
    }
}
