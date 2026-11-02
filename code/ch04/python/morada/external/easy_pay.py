# Simulates the API of a card payment processor. Another company, another format:
# amounts in cents, ISO dates and a reference chosen by whoever creates the payment.


class EasyPayApi:
    def create_payment(self, payment: dict) -> dict:
        if payment["amountCents"] <= 0:
            raise ValueError("invalid amount")
        return {"reference": payment["reference"], "status": "ACTIVE"}
