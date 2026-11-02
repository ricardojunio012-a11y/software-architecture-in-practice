# Open for extension, closed for modification: a new rule is a new class, handed in
# through the constructor. This class does not change.
from morada.after.billing.charge import Charge
from morada.after.billing.types import Entry, Rule


class ChargeCalculator:
    def __init__(self, rules: list[Rule]):
        self._rules = tuple(rules)

    def calculate(self, unit: dict) -> Charge:
        posted: list[Entry] = []
        for rule in self._rules:
            posted += rule.apply(unit, posted)
        return Charge(unit["id"], unit["resident"]["name"], tuple(posted))
