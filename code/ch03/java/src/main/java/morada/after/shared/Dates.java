// Dates come in as parameters: no hidden clock.
package morada.after.shared;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public final class Dates {

    private Dates() {}

    public static long daysBetween(String isoDate, LocalDate today) {
        return ChronoUnit.DAYS.between(LocalDate.parse(isoDate), today);
    }

    public static String monthLabel(LocalDate today) {
        return "%02d/%d".formatted(today.getMonthValue(), today.getYear());
    }
}
