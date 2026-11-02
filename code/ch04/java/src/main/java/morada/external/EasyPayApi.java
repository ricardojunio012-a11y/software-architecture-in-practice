// Simulates the API of a card payment processor. Another company, another format:
// amounts in cents, ISO dates and a reference chosen by whoever creates the payment.
package morada.external;

public class EasyPayApi {

    public record PaymentRequest(
        String reference,
        long amountCents,
        String expiresOn,
        Long discountCents,
        String discountUntil
    ) {}

    public record Response(String reference, String status) {}

    public Response createPayment(PaymentRequest payment) {
        if (payment.amountCents() <= 0) {
            throw new IllegalArgumentException("invalid amount");
        }
        return new Response(payment.reference(), "ACTIVE");
    }
}
