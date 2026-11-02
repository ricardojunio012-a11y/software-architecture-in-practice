from morada.after.billing.types import Entry, amount_of


class BoardPresidentExemption:
    """The board president does not pay the monthly dues (the reserve fund applies)."""

    def apply(self, unit, posted):
        if not unit.get("boardPresident"):
            return []
        dues = amount_of(posted, "dues")
        return [Entry("exemption", "Board president exemption", -dues)]
