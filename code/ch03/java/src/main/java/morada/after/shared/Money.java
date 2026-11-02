// Amounts in cents, rounded half up. Depends on no other module.
package morada.after.shared;

import java.util.Locale;

public final class Money {

    private Money() {}

    public static long shareOf(long cents, long millionths) {
        return (cents * millionths + 500000) / 1000000;
    }

    public static long percentOf(long cents, long percent) {
        return (cents * percent + 50) / 100;
    }

    public static String dollars(long c) {
        String whole = String.format(Locale.US, "%,d", c / 100);
        return whole + "." + "%02d".formatted(c % 100);
    }
}
