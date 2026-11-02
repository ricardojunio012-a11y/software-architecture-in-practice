<?php
// New notification channel: added without touching the email.
namespace Morada\Step4;

// Simulates sending by writing the messages to a file
final class SmsToFile implements Notifier
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
        $text =
            "{$notice->community}: dues {$notice->period->label} " .
            "for unit {$u['id']}: $" .
            Money::dollars($c->total) .
            ", due {$notice->period->dueDate}.";
        if ($c->totalBy5th !== null) {
            $text .=
                " By {$notice->period->discountDeadline}: $" .
                Money::dollars($c->totalBy5th) .
                '.';
        }
        $text .= " {$notice->paymentName}: {$notice->paymentCode}";
        return "To: {$u['resident']['phone']}\n$text\n----\n";
    }
}
