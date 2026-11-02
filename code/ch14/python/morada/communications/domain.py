# The Communications service from chapter 12, now with a notice repository: the
# same notice requested twice is sent only once.
from typing import Protocol


class InvalidDataError(Exception):
    pass


class NoticeRepository(Protocol):
    def already_sent(self, id: str) -> bool: ...

    def record(self, id: str, text: str) -> None: ...


class Communications:
    def __init__(self, notices: NoticeRepository):
        self._notices = notices

    def send(self, id: str, text: str) -> str:
        if not text:
            raise InvalidDataError("text is required")
        if self._notices.already_sent(id):
            return "duplicate"
        self._notices.record(id, text)
        return "sent"


class InMemoryNotices:
    def __init__(self):
        self._notices: dict[str, str] = {}

    def already_sent(self, id: str) -> bool:
        return id in self._notices

    def record(self, id: str, text: str) -> None:
        self._notices[id] = text
