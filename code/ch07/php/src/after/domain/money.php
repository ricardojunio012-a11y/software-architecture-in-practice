<?php
// Value object: immutable, compared by value, and owner of its own rules.
namespace Morada\After\Domain;

require_once __DIR__ . '/error.php';

final readonly class Money
{
    private function __construct(public int $cents)
    {
        if ($cents < 0) {
            throw new DomainError('a money amount must be a whole number of cents');
        }
    }

    public static function fromCents(int $cents): self
    {
        return new self($cents);
    }

    public static function zero(): self
    {
        return new self(0);
    }

    public function add(Money $other): self
    {
        return new self($this->cents + $other->cents);
    }

    // Percentage rounded half up, always in the same place
    public function percent(int $percent): self
    {
        return new self(intdiv($this->cents * $percent + 50, 100));
    }

    public function equals(Money $other): bool
    {
        return $this->cents === $other->cents;
    }

    // $1,234.56
    public function __toString(): string
    {
        return '$' .
            number_format(intdiv($this->cents, 100)) .
            sprintf('.%02d', $this->cents % 100);
    }
}
