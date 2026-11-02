<?php
// Strategy (the channels), Decorator (retries and logging) and Factory (the factory).
namespace Morada;

require_once __DIR__ . '/types.php';

final readonly class Message
{
    public function __construct(public string $title, public string $text) {}
}

interface Channel
{
    public function name(): string;

    public function send(Resident $resident, Message $message): void;
}

// A failure that may go away on a new attempt (provider down, rate limit)
final class TransientError extends \RuntimeException {}

// A failure that repeats on every attempt (no such address, invalid number)
final class PermanentError extends \RuntimeException {}

// Simulates the email, push and SMS providers. Some destinations fail on the
// first attempts, as real providers do, and others are invalid and always fail.
final class SimulatedProvider
{
    /** @var string[] */
    public array $delivered = [];

    public function __construct(
        private array $failures,
        private readonly array $invalid = [],
    ) {}

    public function deliver(string $channel, string $destination, string $text): void
    {
        if (in_array($destination, $this->invalid, true)) {
            throw new PermanentError('no such address');
        }
        if (($this->failures[$destination] ?? 0) > 0) {
            $this->failures[$destination]--;
            throw new TransientError('provider unavailable');
        }
        $this->delivered[] = "$channel $destination | $text";
    }
}

// Each strategy knows the address and the format of its channel
final class Email implements Channel
{
    public function __construct(private readonly SimulatedProvider $provider) {}

    public function name(): string
    {
        return 'email';
    }

    public function send(Resident $resident, Message $m): void
    {
        $this->provider->deliver('email', $resident->email, "{$m->title}: {$m->text}");
    }
}

final class Push implements Channel
{
    public function __construct(private readonly SimulatedProvider $provider) {}

    public function name(): string
    {
        return 'push';
    }

    // The app notification shows the title apart from the text
    public function send(Resident $resident, Message $m): void
    {
        $text = "[{$m->title}] {$m->text}";
        $this->provider->deliver('push', $resident->device, $text);
    }
}

final class Sms implements Channel
{
    public function __construct(private readonly SimulatedProvider $provider) {}

    public function name(): string
    {
        return 'sms';
    }

    // SMS is short: only the title, and the details stay in the app
    public function send(Resident $resident, Message $m): void
    {
        $this->provider->deliver('sms', $resident->phone, "Morada: {$m->title}");
    }
}

// Decorator: logs each attempt without the channel knowing it is being watched
final class WithLogging implements Channel
{
    public function __construct(
        private readonly Channel $channel,
        private array &$log,
    ) {}

    public function name(): string
    {
        return $this->channel->name();
    }

    public function send(Resident $resident, Message $message): void
    {
        $who = "{$this->name()} to {$resident->name}";
        try {
            $this->channel->send($resident, $message);
            $this->log[] = "$who: delivered ({$message->title})";
        } catch (\Throwable $error) {
            $this->log[] = "$who: failed ({$error->getMessage()})";
            throw $error;
        }
    }
}

// Decorator: tries again before giving up, only when the failure is transient,
// and waits longer and longer between attempts (100 ms, 200 ms, 400 ms...).
// $wait does the waiting: in production, a timer; in the lab, a simulated
// clock that only records the wait, so the output is always the same.
final class WithRetries implements Channel
{
    /** @var callable(int, string): void */
    private $wait;

    public function __construct(
        private readonly Channel $channel,
        private readonly int $attempts,
        callable $wait,
        private readonly int $initialWaitMs = 100,
    ) {
        $this->wait = $wait;
    }

    public function name(): string
    {
        return $this->channel->name();
    }

    public function send(Resident $resident, Message $message): void
    {
        for ($attempt = 1; ; $attempt++) {
            try {
                $this->channel->send($resident, $message);
                return;
            } catch (TransientError $error) {
                if ($attempt === $this->attempts) {
                    throw new \RuntimeException(
                        "{$this->name()} failed after $attempt attempts",
                    );
                }
                $wait = $this->initialWaitMs * 2 ** ($attempt - 1);
                ($this->wait)($wait, "{$this->name()} to {$resident->name}");
            } catch (\Throwable $error) {
                // Repeating a permanent failure only wastes time and provider quota
                throw new \RuntimeException(
                    "{$this->name()} failed without retry ({$error->getMessage()})",
                );
            }
        }
    }
}

// Factory: picks the strategy from the resident's preference and wraps it in
// the decorators. Whoever sends notices knows no concrete class.
final class ChannelFactory
{
    /** @var array<string, Channel> */
    private array $channels = [];

    /** @var callable(int, string): void */
    private $wait;

    public function __construct(
        SimulatedProvider $provider,
        private array &$log,
        callable $wait,
    ) {
        $this->wait = $wait;
        foreach (
            [new Email($provider), new Push($provider), new Sms($provider)]
            as $c
        ) {
            $this->channels[$c->name()] = $c;
        }
    }

    public function forResident(Resident $resident): Channel
    {
        $channel = $this->channels[$resident->channel] ?? $this->channels['email'];
        // The order matters: retries outside, logging inside
        $withLogging = new WithLogging($channel, $this->log);
        return new WithRetries($withLogging, 3, $this->wait);
    }
}
