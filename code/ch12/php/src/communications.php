<?php
// The Communications module: sends notices to the residents. It is idempotent on
// the notice id: the same notice requested twice is sent only once.
namespace Morada;

final class Communications
{
    public function __construct(private array $sent = []) {}

    // Returns true if it sent the notice now and false if it had already been sent
    public function send(string $id, string $text): bool
    {
        if (isset($this->sent[$id])) {
            return false;
        }
        $this->sent[$id] = true;
        return true;
    }

    public function sent(): array
    {
        return $this->sent;
    }
}
