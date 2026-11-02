# Adapter: translates the Morada charge into the Alpha Bank API (ACH invoice).
from morada.shared.dates import us_date
from morada.shared.money import plain_dollars
from morada.after.billing.charge import Charge
from morada.after.issuing.gateway import Deadlines, Registration
from morada.external.alpha_bank import AlphaBankClient


class AlphaBankGateway:
    name = "Alpha Bank"

    def __init__(self, client: AlphaBankClient):
        self._client = client

    def register(self, charge: Charge, deadlines: Deadlines) -> Registration:
        request = {
            "payer": charge.resident,
            "amount": plain_dollars(charge.total),
            "dueDate": us_date(deadlines.due_date),
        }
        if charge.discount > 0:
            request["discount"] = {
                "amount": plain_dollars(charge.discount),
                "until": us_date(deadlines.discount_until),
            }
        response = self._client.create_invoice(request)
        return Registration(charge.unit, f"invoice {response['invoiceNumber']}")
