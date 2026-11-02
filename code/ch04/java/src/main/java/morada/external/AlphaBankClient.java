// Simulates the SDK of a bank that creates invoices paid by ACH. The API belongs to
// the bank, not to Morada: amounts as dollar strings and dates as MM/DD/YYYY.
package morada.external;

public class AlphaBankClient {

    public record Discount(String amount, String until) {}

    public record InvoiceRequest(
        String payer,
        String amount,
        String dueDate,
        Discount discount
    ) {}

    public record Invoice(String invoiceNumber) {}

    // Invoices created on the bank's "server" (the test of the before version uses it)
    public static int issued = 0;

    public Invoice createInvoice(InvoiceRequest request) {
        if (request.payer() == null || request.amount() == null) {
            throw new IllegalArgumentException("incomplete request");
        }
        issued++;
        return new Invoice(String.format("INV-%07d", issued));
    }
}
