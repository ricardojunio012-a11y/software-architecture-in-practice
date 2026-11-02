# Beta Bank plugin: another number format, same contract.
from morada.plugins.core import Charge


class BetaBank:
    name = "beta"

    def __init__(self):
        self._last = 0

    def register(self, charge: Charge) -> str:
        self._last += 1
        return f"BETA/{self._last:04d}"


plugin = BetaBank()
