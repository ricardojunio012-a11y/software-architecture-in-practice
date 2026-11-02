// Assorted utilities: whatever did not fit anywhere else (coincidental cohesion).
package morada.before.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import morada.before.config.Config;

public final class Util {

    private Util() {}

    public static String dollars(long c) {
        String whole = String.format(Locale.US, "%,d", c / 100);
        return whole + "." + "%02d".formatted(c % 100);
    }

    // Depends, without saying so, on the date kept in the global configuration
    public static long daysLate(String dueDate) {
        return ChronoUnit.DAYS.between(LocalDate.parse(dueDate), Config.today);
    }

    public static String period() {
        return "%02d/%d".formatted(
            Config.today.getMonthValue(),
            Config.today.getYear()
        );
    }
}
