# Observer: whoever publishes an event does not know who reacts to it.
from dataclasses import dataclass
from typing import Protocol

from morada.types import BookingRequest


@dataclass(frozen=True)
class Event:
    type: str  # "BookingConfirmed" or "BookingRejected"
    request: BookingRequest
    reason: str | None = None


class Subscriber(Protocol):
    name: str

    def handle(self, event: Event) -> None: ...


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Subscriber]] = {}
        self.failures: list[str] = []

    def subscribe(self, type: str, subscriber: Subscriber) -> None:
        self._subscribers.setdefault(type, []).append(subscriber)

    def publish(self, event: Event) -> None:
        """A subscriber that fails does not stop the others from receiving the event."""
        for subscriber in self._subscribers.get(event.type, []):
            try:
                subscriber.handle(event)
            except Exception as error:
                id = event.request.id
                self.failures.append(f"{event.type} {id}: {subscriber.name}: {error}")
