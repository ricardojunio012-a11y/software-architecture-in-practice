// New payment method: added without touching the calculation or the invoice.
// Made-up code: in a real system, it would come from the card payment processor.
package morada.step4;

public class Card implements PaymentMethod {

    @Override
    public String name() {
        return "Card payment";
    }

    @Override
    public String generateCode(
        String communityId,
        BillingPeriod period,
        Charge charge
    ) {
        return (
            "CARD-" +
            communityId +
            "-" +
            period.code() +
            "-" +
            charge.unit().id() +
            "-" +
            charge.total()
        );
    }
}
