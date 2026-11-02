// The result of the calculation for one unit, in cents.
package morada.step4;

public record Charge(
    Unit unit,
    long dues,
    long reserve,
    long arrears,
    long lateFee,
    long interest,
    long total,
    // amount with the early-payment discount; null if the unit does not qualify
    Long totalBy5th
) {}
