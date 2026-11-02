# Simulates the SDK of a bank that creates invoices paid by ACH. The API belongs to
# the bank, not to Morada: amounts as dollar strings and dates as MM/DD/YYYY.


class AlphaBankClient:
    # Invoices created on the bank's "server" (the test of the before version uses it)
    issued = 0

    def create_invoice(self, request: dict) -> dict:
        if not request.get("payer") or not request.get("amount"):
            raise ValueError("incomplete request")
        AlphaBankClient.issued += 1
        return {"invoiceNumber": f"INV-{AlphaBankClient.issued:07d}"}
