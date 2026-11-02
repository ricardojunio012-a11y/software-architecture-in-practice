# The Billing table: private data of the module. No other module should read it.
from dataclasses import dataclass, field


@dataclass
class ChargeRow:
    charge: str
    unit: str
    amount_cents: int
    due_date: str
    status: str = "open"
    installments: int = 1


@dataclass
class ChargesTable:
    rows: list[ChargeRow] = field(default_factory=list)

    def find(self, charge: str) -> ChargeRow:
        for row in self.rows:
            if row.charge == charge:
                return row
        raise LookupError(f"charge {charge} not found")
