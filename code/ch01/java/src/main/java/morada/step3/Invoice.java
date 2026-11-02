// Made-up code: in a real system, it would come from the payment processor.
package morada.step3;

public class Invoice implements PaymentMethod {

    @Override
    public String name() {
        return "Invoice";
    }

    @Override
    public String generateCode(
        String communityId,
        BillingPeriod period,
        Charge charge
    ) {
        return (
            "INV-" +
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
