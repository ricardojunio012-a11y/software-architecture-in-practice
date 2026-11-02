// Dates in ISO format (YYYY-MM-DD) and "today" received as a parameter.
package morada.shared;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public final class Dates {

    private Dates() {}

    public static long daysBetween(String isoDate, LocalDate today) {
        return ChronoUnit.DAYS.between(LocalDate.parse(isoDate), today);
    }

    public static String dateInMonth(LocalDate today, int day) {
        return today.withDayOfMonth(day).toString();
    }

    public static String monthLabel(LocalDate today) {
        return String.format("%02d/%d", today.getMonthValue(), today.getYear());
    }

    // 2026-03-10 -> 03/10
    public static String monthDay(String isoDate) {
        return isoDate.substring(5, 7) + "/" + isoDate.substring(8, 10);
    }

    // 2026-03-10 -> 03/10/2026
    public static String usDate(String isoDate) {
        return monthDay(isoDate) + "/" + isoDate.substring(0, 4);
    }
}
