// The result of the calculation for one unit, in cents.
package morada.step3;

public record Charge(
    Unit unit,
    long dues,
    long reserve,
    long arrears,
    long lateFee,
    long interest,
    long total
) {}
