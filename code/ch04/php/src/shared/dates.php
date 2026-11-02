<?php
// Dates in ISO format (YYYY-MM-DD) and "today" received as a parameter.
namespace Morada\Shared;

function daysBetween(string $isoDate, \DateTimeImmutable $today): int
{
    $date = new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC'));
    return intdiv($today->getTimestamp() - $date->getTimestamp(), 86400);
}

function dateInMonth(\DateTimeImmutable $today, int $day): string
{
    return $today->format('Y-m-') . sprintf('%02d', $day);
}

function monthLabel(\DateTimeImmutable $today): string
{
    return $today->format('m/Y');
}

// 2026-03-10 -> 03/10
function monthDay(string $isoDate): string
{
    return substr($isoDate, 5, 2) . '/' . substr($isoDate, 8, 2);
}

// 2026-03-10 -> 03/10/2026
function usDate(string $isoDate): string
{
    return monthDay($isoDate) . '/' . substr($isoDate, 0, 4);
}
