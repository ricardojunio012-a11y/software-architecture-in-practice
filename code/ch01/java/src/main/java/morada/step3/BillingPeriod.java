// The billing period of the charge and the dates that depend on it.
package morada.step3;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record BillingPeriod(
    LocalDate today,
    String label, // "03/2026"
    String code, // "202603"
    String dueDate // "03/10/2026"
) {
    public static BillingPeriod of(LocalDate today) {
        String month = String.format("%02d", today.getMonthValue());
        int year = today.getYear();
        return new BillingPeriod(
            today,
            month + "/" + year,
            year + month,
            month + "/10/" + year
        );
    }

    // Calendar days between a date (YYYY-MM-DD) and today
    public static long daysSince(String isoDate, LocalDate today) {
        return ChronoUnit.DAYS.between(LocalDate.parse(isoDate), today);
    }
}
