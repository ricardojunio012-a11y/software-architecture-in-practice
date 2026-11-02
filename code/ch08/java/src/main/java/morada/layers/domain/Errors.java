// Domain layer: the errors speak the language of the business, not of HTTP.
package morada.layers.domain;

import java.util.Locale;

public final class Errors {

    private Errors() {}

    public static class RuleViolationError extends RuntimeException {

        public RuleViolationError(String message) {
            super(message);
        }
    }

    public static class NotFoundError extends RuntimeException {

        public NotFoundError(String message) {
            super(message);
        }
    }

    public static String dollars(long cents) {
        String whole = String.format(Locale.US, "%,d", cents / 100);
        return "$" + whole + "." + String.format("%02d", cents % 100);
    }
}
