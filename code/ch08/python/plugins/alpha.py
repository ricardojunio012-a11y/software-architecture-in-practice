# Alpha Bank plugin: numbers the invoices in sequence, with five digits.
from morada.plugins.core import Charge


class AlphaBank:
    name = "alpha"

    def __init__(self):
        self._last = 0

    def register(self, charge: Charge) -> str:
        self._last += 1
        return f"ALPHA-{self._last:05d}"


plugin = AlphaBank()
