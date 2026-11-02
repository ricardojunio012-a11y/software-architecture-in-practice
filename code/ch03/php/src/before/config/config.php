<?php
// Global configuration: any module reads and changes it (common coupling).
namespace Morada\Before\Config;

final class Config
{
    public static int $reservePercent = 10;
    public static int $lateFeePercent = 2;
    public static ?\DateTimeImmutable $today = null;
    public static array $data = []; // the whole community, filled in by main
}
