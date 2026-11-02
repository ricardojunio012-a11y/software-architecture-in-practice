// The center of the hexagon: the errors speak the language of the business, not HTTP.
package morada.domain;

import java.util.Locale;

public final class Errors {

    private Errors() {}

    public static class RuleViolatedError extends RuntimeException {

        public RuleViolatedError(String message) {
            super(message);
        }
    }

    public static class NotFoundError extends RuntimeException {

        public NotFoundError(String message) {
            super(message);
        }
    }

    // $1,234.56
    public static String dollars(long cents) {
        String whole = String.format(Locale.US, "%,d", cents / 100);
        return "$" + whole + "." + String.format("%02d", cents % 100);
    }
}
