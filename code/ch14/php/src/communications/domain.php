<?php
// The Communications service from chapter 12, now with a notice repository: the
// same notice requested twice is sent only once.
namespace Morada\Communications;

class InvalidDataError extends \RuntimeException {}

interface NoticeRepository
{
    public function alreadySent(string $id): bool;

    public function record(string $id, string $text): void;
}

final class Communications
{
    public function __construct(private readonly NoticeRepository $notices) {}

    public function send(string $id, string $text): string
    {
        if ($text === '') {
            throw new InvalidDataError('text is required');
        }
        if ($this->notices->alreadySent($id)) {
            return 'duplicate';
        }
        $this->notices->record($id, $text);
        return 'sent';
    }
}

final class InMemoryNotices implements NoticeRepository
{
    private array $notices = [];

    public function alreadySent(string $id): bool
    {
        return isset($this->notices[$id]);
    }

    public function record(string $id, string $text): void
    {
        $this->notices[$id] = $text;
    }
}
