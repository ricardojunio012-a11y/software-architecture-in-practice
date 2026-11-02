// Integration event published by Billing. It carries the data the subscribers need
// (event-carried state transfer), so they do not have to query Billing.
package morada;

public final class Events {

    private Events() {}

    public record Payment(
        String payment,
        String unit,
        String booking,
        long amountCents,
        String failure
    ) {}

    public record PaymentConfirmed(
        String event,
        String type,
        String payment,
        String unit,
        String booking,
        long amountCents
    ) {}

    // Stable identifier: the same payment always produces the same event
    public static PaymentConfirmed eventFor(Payment p) {
        return new PaymentConfirmed(
            "E-" + p.payment(),
            "PaymentConfirmed",
            p.payment(),
            p.unit(),
            p.booking(),
            p.amountCents()
        );
    }

    public static String dollars(long cents) {
        String whole = String.format(java.util.Locale.US, "%,d", cents / 100);
        return "$" + whole + "." + String.format("%02d", cents % 100);
    }
}
