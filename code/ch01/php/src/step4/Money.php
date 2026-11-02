<?php
// Amounts always in cents (integers), so no precision is lost.
// Rounding: half a cent rounds up.
namespace Morada\Step4;

final class Money
{
    public static function shareOf(int $cents, int $millionths): int
    {
        return intdiv($cents * $millionths + 500000, 1000000);
    }

    public static function percentOf(int $cents, int $percent): int
    {
        return intdiv($cents * $percent + 50, 100);
    }

    // 123456 -> "1,234.56"
    public static function dollars(int $cents): string
    {
        return number_format(intdiv($cents, 100), 0, '.', ',') .
            '.' .
            str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
