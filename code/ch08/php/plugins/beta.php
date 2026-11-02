<?php
// Beta Bank plugin: another number format, same contract.
use Morada\Plugins\{Charge, BankPlugin};

return new class implements BankPlugin {
    private int $last = 0;

    public function name(): string
    {
        return 'beta';
    }

    public function register(Charge $charge): string
    {
        $this->last++;
        return sprintf('BETA/%04d', $this->last);
    }
};
