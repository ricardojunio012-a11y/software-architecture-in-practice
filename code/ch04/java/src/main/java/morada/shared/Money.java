// Amounts in cents and half-up rounding.
package morada.shared;

import java.util.Locale;

public final class Money {

    private Money() {}

    public static long shareOf(long cents, long millionths) {
        return (cents * millionths + 500000) / 1000000;
    }

    public static long percentOf(long cents, long percent) {
        return (cents * percent + 50) / 100;
    }

    // 1,352.18 (US format, with a sign when negative)
    public static String dollars(long c) {
        long a = Math.abs(c);
        String whole = String.format(Locale.US, "%,d", a / 100);
        return (c < 0 ? "-" : "") + whole + "." + String.format("%02d", a % 100);
    }

    // 1352.18 (the format the Alpha Bank API asks for)
    public static String plainDollars(long c) {
        return c / 100 + "." + String.format("%02d", c % 100);
    }
}
