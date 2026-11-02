// Public API of Bookings. The module declares what it needs to know from Billing
// (FinancialStanding) without depending on how Billing stores its data.
package morada.after.modules.bookings;

import java.util.List;
import morada.after.modules.bookings.internal.Schedule;

public class Bookings {

    public interface FinancialStanding {
        boolean unitInGoodStanding(String unit, String today);
    }

    public static class RejectionError extends RuntimeException {

        public RejectionError(String message) {
            super(message);
        }
    }

    private final Schedule schedule;
    private final FinancialStanding billing;

    public Bookings(List<String> spaces, FinancialStanding billing) {
        this.schedule = new Schedule(spaces);
        this.billing = billing;
    }

    public String book(
        String booking,
        String unit,
        String space,
        String date,
        String today
    ) {
        if (!billing.unitInGoodStanding(unit, today)) {
            throw new RejectionError("unit " + unit + " in arrears");
        }
        if (schedule.occupant(space, date) != null) {
            throw new RejectionError(space + " already booked on " + date);
        }
        schedule.record(booking, space, date);
        return unit + " " + space + " " + date;
    }
}
