<?php
// Anemic model: only data, all public and writable. No rule lives here.
namespace Morada\Before;

class Booking
{
    public string $id = '';
    public string $unit = '';
    public string $space = '';
    public string $date = '';
    public int $start = 0;
    public int $end = 0;
    public string $status = 'confirmed';
    public int $feeCents = 0;
}

// The data of every booking, which any part of the system can read and change
final class Bookings
{
    /** @var Booking[] */
    public static array $all = [];
}
