<?php
// The booking data and small date and money functions.
namespace Morada;

final readonly class Space
{
    public function __construct(
        public string $id,
        public string $name,
        public int $feeCents,
        public int $minNoticeDays,
        public int $monthlyLimit,
    ) {}
}

final readonly class Resident
{
    public function __construct(
        public string $name,
        public string $email,
        public string $channel,
        public ?string $phone = null,
        public ?string $device = null,
    ) {}
}

final readonly class Unit
{
    public function __construct(
        public string $id,
        public bool $inArrears,
        public Resident $resident,
    ) {}
}

final readonly class BookingRequest
{
    public function __construct(
        public string $id,
        public Unit $unit,
        public Space $space,
        public string $date,
    ) {}
}

final readonly class Decision
{
    public function __construct(public bool $approved, public ?string $reason = null) {}
}

function daysBetween(\DateTimeImmutable $today, string $isoDate): int
{
    $date = new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC'));
    return intdiv($date->getTimestamp() - $today->getTimestamp(), 86400);
}

// 2026-03-14 -> 03/14/2026
function usDate(string $isoDate): string
{
    [$year, $month, $day] = explode('-', $isoDate);
    return "$month/$day/$year";
}

// 15000 -> 150.00 (US format)
function dollars(int $c): string
{
    return number_format(intdiv($c, 100), 0, '.', ',') .
        '.' .
        sprintf('%02d', $c % 100);
}
