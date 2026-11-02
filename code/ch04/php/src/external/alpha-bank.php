<?php
// Simulates the SDK of a bank that creates invoices paid by ACH. The API belongs to
// the bank, not to Morada: amounts as dollar strings and dates as MM/DD/YYYY.
namespace Morada\External;

class AlphaBankClient
{
    // Invoices created on the bank's "server" (the test of the before version uses it)
    public static int $issued = 0;

    public function createInvoice(array $request): array
    {
        if (empty($request['payer']) || empty($request['amount'])) {
            throw new \InvalidArgumentException('incomplete request');
        }
        self::$issued++;
        return ['invoiceNumber' => sprintf('INV-%07d', self::$issued)];
    }
}
