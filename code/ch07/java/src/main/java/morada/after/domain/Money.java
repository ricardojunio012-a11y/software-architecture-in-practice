// Value object: immutable, compared by value, and owner of its own rules.
package morada.after.domain;

import java.util.Locale;

public record Money(long cents) {
    public static final Money ZERO = new Money(0);

    public Money {
        if (cents < 0) {
            throw new DomainError("a money amount must be a whole number of cents");
        }
    }

    public Money add(Money other) {
        return new Money(cents + other.cents);
    }

    // Percentage rounded half up, always in the same place
    public Money percent(long percent) {
        return new Money((cents * percent + 50) / 100);
    }

    // $1,234.56
    @Override
    public String toString() {
        return String.format(Locale.US, "$%,d.%02d", cents / 100, cents % 100);
    }
}
