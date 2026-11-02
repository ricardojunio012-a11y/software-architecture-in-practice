// Amounts always in cents (integers), so no precision is lost.
// Rounding: half a cent rounds up.
package morada.billing;

import java.util.Locale;

public final class Money {

    private Money() {}

    public static long shareOf(long cents, long millionths) {
        return (cents * millionths + 500000) / 1000000;
    }

    public static long percentOf(long cents, long percent) {
        return (cents * percent + 50) / 100;
    }

    // 123456 -> "1,234.56"
    public static String dollars(long cents) {
        return (
            String.format(Locale.US, "%,d", cents / 100) +
            "." +
            String.format("%02d", cents % 100)
        );
    }
}
