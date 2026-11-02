<?php
// Tests: the Communications module is the same inside and outside the monolith.
require_once __DIR__ . '/../src/communications.php';

use Morada\Communications;
use PHPUnit\Framework\TestCase;

final class CommunicationsTest extends TestCase
{
    public function testSendsEachNoticeOnlyOnceEvenWhenAskedAgain(): void
    {
        $communications = new Communications();
        $this->assertTrue($communications->send('E-P-001', 'payment received'));
        $this->assertFalse($communications->send('E-P-001', 'payment received'));
        $this->assertTrue($communications->send('E-P-002', 'payment received'));
    }
}
