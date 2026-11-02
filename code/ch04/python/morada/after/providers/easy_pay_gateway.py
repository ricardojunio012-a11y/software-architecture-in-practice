# Adapter: translates the Morada charge into the EasyPay API (card payment).
from morada.after.billing.charge import Charge
from morada.after.issuing.gateway import Deadlines, Registration
from morada.external.easy_pay import EasyPayApi


class EasyPayGateway:
    name = "EasyPay"

    def __init__(self, api: EasyPayApi):
        self._api = api

    def register(self, charge: Charge, deadlines: Deadlines) -> Registration:
        # One reference per month and unit: MORADA202603A101
        month = deadlines.due_date[:7].replace("-", "")
        request = {
            "reference": "MORADA" + month + charge.unit.replace("-", ""),
            "amountCents": charge.total,
            "expiresOn": deadlines.due_date,
        }
        if charge.discount > 0:
            request["discountCents"] = charge.discount
            request["discountUntil"] = deadlines.discount_until
        response = self._api.create_payment(request)
        return Registration(charge.unit, f"card {response['reference']}")
