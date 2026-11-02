# Global configuration: any module reads and changes it (common coupling).
from datetime import date
from types import SimpleNamespace

config = SimpleNamespace(
    reserve_percent=10,
    late_fee_percent=2,
    today=date.today(),
    data=None,  # the whole community, filled in by main
)
