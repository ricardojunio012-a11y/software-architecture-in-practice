# The abstraction belongs to Morada, not to the providers: issuing is what says what
# it needs. Each provider gets an adapter that implements this interface.
from dataclasses import dataclass
from typing import Protocol

from morada.after.billing.charge import Charge


@dataclass(frozen=True)
class Deadlines:
    due_date: str
    discount_until: str


@dataclass(frozen=True)
class Registration:
    unit: str
    identifier: str


class PaymentGateway(Protocol):
    name: str

    def register(self, charge: Charge, deadlines: Deadlines) -> Registration: ...
