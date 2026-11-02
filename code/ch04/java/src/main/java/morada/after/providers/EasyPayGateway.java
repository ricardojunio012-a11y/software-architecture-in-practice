// Adapter: translates the Morada charge into the EasyPay API (card payment).
package morada.after.providers;

import morada.after.billing.Charge;
import morada.after.issuing.PaymentGateway;
import morada.external.EasyPayApi;
import morada.external.EasyPayApi.PaymentRequest;

public class EasyPayGateway implements PaymentGateway {

    private final EasyPayApi api;

    public EasyPayGateway(EasyPayApi api) {
        this.api = api;
    }

    @Override
    public String name() {
        return "EasyPay";
    }

    @Override
    public Registration register(Charge charge, Deadlines deadlines) {
        // One reference per month and unit: MORADA202603A101
        String month = deadlines.dueDate().substring(0, 7).replace("-", "");
        boolean hasDiscount = charge.discount() > 0;
        var response = api.createPayment(
            new PaymentRequest(
                "MORADA" + month + charge.unit().replace("-", ""),
                charge.total(),
                deadlines.dueDate(),
                hasDiscount ? charge.discount() : null,
                hasDiscount ? deadlines.discountUntil() : null
            )
        );
        return new Registration(charge.unit(), "card " + response.reference());
    }
}
