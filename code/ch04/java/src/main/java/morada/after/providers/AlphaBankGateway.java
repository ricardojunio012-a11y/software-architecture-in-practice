// Adapter: translates the Morada charge into the Alpha Bank API (ACH invoice).
package morada.after.providers;

import static morada.shared.Dates.usDate;
import static morada.shared.Money.plainDollars;

import morada.after.billing.Charge;
import morada.after.issuing.PaymentGateway;
import morada.external.AlphaBankClient;
import morada.external.AlphaBankClient.Discount;
import morada.external.AlphaBankClient.InvoiceRequest;

public class AlphaBankGateway implements PaymentGateway {

    private final AlphaBankClient client;

    public AlphaBankGateway(AlphaBankClient client) {
        this.client = client;
    }

    @Override
    public String name() {
        return "Alpha Bank";
    }

    @Override
    public Registration register(Charge charge, Deadlines deadlines) {
        Discount discount =
            charge.discount() > 0
                ? new Discount(
                      plainDollars(charge.discount()),
                      usDate(deadlines.discountUntil())
                  )
                : null;
        var invoice = client.createInvoice(
            new InvoiceRequest(
                charge.resident(),
                plainDollars(charge.total()),
                usDate(deadlines.dueDate()),
                discount
            )
        );
        return new Registration(charge.unit(), "invoice " + invoice.invoiceNumber());
    }
}
