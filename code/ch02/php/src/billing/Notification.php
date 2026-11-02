<?php
// How the resident learns about the charge.
namespace Morada\Billing;

final class Notice
{
    public function __construct(
        public readonly string $community,
        public readonly BillingPeriod $period,
        public readonly Charge $charge,
        public readonly string $paymentName,
        public readonly string $paymentCode,
    ) {}
}

interface Notifier
{
    public function notify(Notice $notice): void;
}

// Simulates sending by writing the messages to a file
final class EmailToFile implements Notifier
{
    public function __construct(private readonly string $file)
    {
        file_put_contents($file, '');
    }

    public function notify(Notice $notice): void
    {
        file_put_contents($this->file, self::format($notice), FILE_APPEND);
    }

    public static function format(Notice $notice): string
    {
        $c = $notice->charge;
        $u = $c->unit;
        $lines = [
            "To: {$u['resident']['email']}",
            "Subject: Monthly dues {$notice->period->label} - " .
            "{$notice->community} - Unit {$u['id']}",
            '',
            "Hello, {$u['resident']['name']}.",
            '',
            "The monthly dues for {$notice->period->label} " .
            "for unit {$u['id']} are now available.",
            'Amount: $' . Money::dollars($c->total),
            "Due date: {$notice->period->dueDate}",
        ];
        if ($c->totalBy5th !== null) {
            $lines[] =
                "Pay by {$notice->period->discountDeadline} " .
                "and the amount drops to $" .
                Money::dollars($c->totalBy5th) .
                '.';
        }
        if ($c->arrears > 0) {
            $lines[] =
                'Includes a past-due balance of $' .
                Money::dollars($c->arrears) .
                ', with a late fee of $' .
                Money::dollars($c->lateFee) .
                ' and interest of $' .
                Money::dollars($c->interest) .
                '.';
        }
        array_push(
            $lines,
            "{$notice->paymentName}: {$notice->paymentCode}",
            '',
            "{$notice->community} Management",
            '----',
        );
        return implode("\n", $lines) . "\n";
    }
}
