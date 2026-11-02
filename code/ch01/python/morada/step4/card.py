# New payment method: added without touching the calculation or the invoice.
from morada.step4.calculation import Charge
from morada.step4.period import BillingPeriod


# Made-up code: in a real system, it would come from the card payment processor
class Card:
    name = "Card payment"

    def generate_code(
        self, community_id: str, period: BillingPeriod, charge: Charge
    ) -> str:
        unit = charge.unit["id"]
        return f"CARD-{community_id}-{period.code}-{unit}-{charge.total}"
