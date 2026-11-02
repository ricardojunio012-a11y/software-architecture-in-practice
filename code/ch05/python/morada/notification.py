# Strategy (the channels), Decorator (retries and logging) and Factory (the factory).
from dataclasses import dataclass
from typing import Protocol

from morada.types import Resident


@dataclass(frozen=True)
class Message:
    title: str
    text: str


class Channel(Protocol):
    name: str

    def send(self, resident: Resident, message: Message) -> None: ...


class TransientError(Exception):
    """A failure that may go away on a new attempt (provider down, rate limit)."""


class PermanentError(Exception):
    """A failure that repeats on every attempt (no such address)."""


class SimulatedProvider:
    """Simulates the email, push and SMS providers. Some destinations fail on the
    first attempts, as real providers do, and others are invalid and always fail."""

    def __init__(self, failures: dict[str, int], invalid=()):
        self._failures = dict(failures)
        self._invalid = set(invalid)
        self.delivered: list[str] = []

    def deliver(self, channel: str, destination: str, text: str) -> None:
        if destination in self._invalid:
            raise PermanentError("no such address")
        if self._failures.get(destination, 0) > 0:
            self._failures[destination] -= 1
            raise TransientError("provider unavailable")
        self.delivered.append(f"{channel} {destination} | {text}")


# Each strategy knows the address and the format of its channel
class Email:
    name = "email"

    def __init__(self, provider: SimulatedProvider):
        self._provider = provider

    def send(self, resident, m):
        self._provider.deliver(self.name, resident.email, f"{m.title}: {m.text}")


class Push:
    name = "push"

    def __init__(self, provider: SimulatedProvider):
        self._provider = provider

    def send(self, resident, m):
        # The app notification shows the title apart from the text
        self._provider.deliver(self.name, resident.device, f"[{m.title}] {m.text}")


class Sms:
    name = "sms"

    def __init__(self, provider: SimulatedProvider):
        self._provider = provider

    def send(self, resident, m):
        # SMS is short: only the title, and the details stay in the app
        self._provider.deliver(self.name, resident.phone, f"Morada: {m.title}")


class WithLogging:
    """Decorator: logs each attempt without the channel knowing it is being watched."""

    def __init__(self, channel: Channel, log: list[str]):
        self._channel = channel
        self._log = log
        self.name = channel.name

    def send(self, resident, message):
        who = f"{self.name} to {resident.name}"
        try:
            self._channel.send(resident, message)
            self._log.append(f"{who}: delivered ({message.title})")
        except Exception as error:
            self._log.append(f"{who}: failed ({error})")
            raise


class WithRetries:
    """Decorator: tries again before giving up, only when the failure is transient,
    and waits longer and longer between attempts (100 ms, 200 ms, 400 ms...).
    The wait function does the waiting: in production, a timer; in the lab, a
    simulated clock that only records the wait, so the output is always the same."""

    def __init__(self, channel: Channel, attempts: int, wait, wait_ms: int = 100):
        self._channel = channel
        self._attempts = attempts
        self._wait = wait
        self._initial_wait_ms = wait_ms
        self.name = channel.name

    def send(self, resident, message):
        for attempt in range(1, self._attempts + 1):
            try:
                return self._channel.send(resident, message)
            except TransientError:
                if attempt == self._attempts:
                    raise RuntimeError(f"{self.name} failed after {attempt} attempts")
                wait = self._initial_wait_ms * 2 ** (attempt - 1)
                self._wait(wait, f"{self.name} to {resident.name}")
            except Exception as error:
                # Repeating a permanent failure only wastes time and provider quota
                raise RuntimeError(f"{self.name} failed without retry ({error})")


class ChannelFactory:
    """Factory: picks the strategy from the resident's preference and wraps it in
    the decorators. Whoever sends notices knows no concrete class."""

    def __init__(self, provider: SimulatedProvider, log: list[str], wait):
        channels = [Email(provider), Push(provider), Sms(provider)]
        self._channels = {c.name: c for c in channels}
        self._log = log
        self._wait = wait

    def for_resident(self, resident: Resident) -> Channel:
        channel = self._channels.get(resident.channel, self._channels["email"])
        # The order matters: retries outside, logging inside
        return WithRetries(WithLogging(channel, self._log), 3, self._wait)
