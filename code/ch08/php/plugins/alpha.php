<?php
// Alpha Bank plugin: numbers the invoices in sequence, with five digits.
use Morada\Plugins\{Charge, BankPlugin};

return new class implements BankPlugin {
    private int $last = 0;

    public function name(): string
    {
        return 'alpha';
    }

    public function register(Charge $charge): string
    {
        $this->last++;
        return sprintf('ALPHA-%05d', $this->last);
    }
};
