// Everything a channel needs to notify the resident.
package morada.step3;

public record Notice(
    String community,
    BillingPeriod period,
    Charge charge,
    String paymentName,
    String paymentCode
) {}
