// One unit's calculated charge, immutable: no one changes what belongs to another.
package morada.after.charges;

public record Charge(
    String unit,
    String resident,
    long dues,
    long reserve,
    long arrears,
    long daysLate,
    long lateFee,
    long interest,
    long total
) {}
