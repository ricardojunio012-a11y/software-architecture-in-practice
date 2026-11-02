<?php
// EasyPay plugin: creates a card payment identified by the unit.
use Morada\Plugins\{Charge, BankPlugin};

return new class implements BankPlugin {
    public function name(): string
    {
        return 'easypay';
    }

    public function register(Charge $charge): string
    {
        return 'CARD-' . str_replace('-', '', $charge->unit);
    }
};
