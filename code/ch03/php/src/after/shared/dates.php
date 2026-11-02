<?php
// Dates come in as parameters: no hidden clock.
namespace Morada\After\Shared;

function daysBetween(string $isoDate, \DateTimeImmutable $today): int
{
    return (new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC')))->diff(
        $today,
    )->days;
}

function monthLabel(\DateTimeImmutable $today): string
{
    return $today->format('m/Y');
}
