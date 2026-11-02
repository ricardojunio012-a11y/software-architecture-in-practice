# EasyPay plugin: creates a card payment identified by the unit.
from morada.plugins.core import Charge


class EasyPay:
    name = "easypay"

    def register(self, charge: Charge) -> str:
        return "CARD-" + charge.unit.replace("-", "")


plugin = EasyPay()
