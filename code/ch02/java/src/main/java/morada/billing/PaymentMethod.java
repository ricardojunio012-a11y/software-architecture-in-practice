// How the resident pays. The calculation does not know which method it is.
package morada.billing;

public interface PaymentMethod {
    String name();

    String generateCode(String communityId, BillingPeriod period, Charge charge);
}
