// Everything a channel needs to notify the resident.
package morada.billing;

public record Notice(
    String community,
    BillingPeriod period,
    Charge charge,
    String paymentName,
    String paymentCode
) {}
