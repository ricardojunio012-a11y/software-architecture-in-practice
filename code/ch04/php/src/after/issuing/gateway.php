<?php
// The abstraction belongs to Morada, not to the providers: issuing is what says what
// it needs. Each provider gets an adapter that implements this interface.
namespace Morada\After\Issuing;

require_once __DIR__ . '/../billing/charge.php';

use Morada\After\Billing\Charge;

final readonly class Deadlines
{
    public function __construct(public string $dueDate, public string $discountUntil) {}
}

final readonly class Registration
{
    public function __construct(public string $unit, public string $identifier) {}
}

interface PaymentGateway
{
    public function name(): string;

    public function register(Charge $charge, Deadlines $deadlines): Registration;
}
