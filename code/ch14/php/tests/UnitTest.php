<?php
// Unit tests: the service's rule, with no network and no database. They run in
// milliseconds.
require_once __DIR__ . '/../src/communications/domain.php';

use Morada\Communications\{Communications, InMemoryNotices, InvalidDataError};
use PHPUnit\Framework\TestCase;

final class UnitTest extends TestCase
{
    public function testSendsANewNotice(): void
    {
        $communications = new Communications(new InMemoryNotices());
        $this->assertSame('sent', $communications->send('E-1', 'payment received'));
    }

    public function testRecognizesADuplicateNotice(): void
    {
        $communications = new Communications(new InMemoryNotices());
        $communications->send('E-1', 'payment received');
        $this->assertSame(
            'duplicate',
            $communications->send('E-1', 'payment received'),
        );
    }

    public function testRejectsANoticeWithoutText(): void
    {
        $this->expectException(InvalidDataError::class);
        (new Communications(new InMemoryNotices()))->send('E-1', '');
    }
}
