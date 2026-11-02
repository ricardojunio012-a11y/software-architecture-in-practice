# How the resident pays. The calculation does not know which method it is.
from typing import Protocol

from morada.billing.calculation import Charge
from morada.billing.period import BillingPeriod


class PaymentMethod(Protocol):
    name: str

    def generate_code(
        self, community_id: str, period: BillingPeriod, charge: Charge
    ) -> str: ...


# Made-up code: in a real system, it would come from the payment processor
class Invoice:
    name = "Invoice"

    def generate_code(
        self, community_id: str, period: BillingPeriod, charge: Charge
    ) -> str:
        unit = charge.unit["id"]
        return f"INV-{community_id}-{period.code}-{unit}-{charge.total}"
