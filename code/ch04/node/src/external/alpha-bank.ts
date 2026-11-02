// Simulates the SDK of a bank that creates invoices paid by ACH. The API belongs to
// the bank, not to Morada: amounts as dollar strings and dates as MM/DD/YYYY.
export interface InvoiceRequest {
  payer: string;
  amount: string;
  dueDate: string;
  discount?: { amount: string; until: string };
}

export class AlphaBankClient {
  // Invoices created on the bank's "server" (the test of the before version uses it)
  static issued = 0;

  createInvoice(request: InvoiceRequest): { invoiceNumber: string } {
    if (!request.payer || !request.amount) throw new Error("incomplete request");
    AlphaBankClient.issued++;
    return { invoiceNumber: "INV-" + String(AlphaBankClient.issued).padStart(7, "0") };
  }
}
