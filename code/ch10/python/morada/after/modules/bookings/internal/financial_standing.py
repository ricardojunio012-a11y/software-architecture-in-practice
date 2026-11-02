# After: Bookings asks Billing through the public API. The delinquency rule stays
# in one place, the module that owns it.
from morada.after.modules.billing.api import Billing


class StandingFromBilling:
    def __init__(self, billing: Billing):
        self._billing = billing

    def unit_in_good_standing(self, unit: str, today: str) -> bool:
        return self._billing.unit_in_good_standing(unit, today)
