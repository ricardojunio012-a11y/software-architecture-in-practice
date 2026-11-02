// The booking data and small date and money functions.
package morada;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

public final class Types {

    private Types() {}

    public record Space(
        String id,
        String name,
        long feeCents,
        int minNoticeDays,
        int monthlyLimit
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Resident(
        String name,
        String email,
        String channel,
        String phone,
        String device
    ) {}

    public record Unit(String id, boolean inArrears, Resident resident) {}

    public record BookingRequest(String id, Unit unit, Space space, String date) {}

    public record Decision(boolean approved, String reason) {
        public static Decision approve() {
            return new Decision(true, null);
        }
    }

    public static long daysBetween(LocalDate today, String isoDate) {
        return ChronoUnit.DAYS.between(today, LocalDate.parse(isoDate));
    }

    // 2026-03-14 -> 03/14/2026
    public static String usDate(String isoDate) {
        String[] p = isoDate.split("-");
        return p[1] + "/" + p[2] + "/" + p[0];
    }

    // 15000 -> 150.00 (US format)
    public static String dollars(long c) {
        return String.format(Locale.US, "%,d.%02d", c / 100, c % 100);
    }
}
