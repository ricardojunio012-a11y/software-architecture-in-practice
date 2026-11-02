// Chain of Responsibility: each stage checks one rule and, if the request passes,
// hands it to the next. The skeleton of evaluate() is a Template Method.
package morada;

import java.time.LocalDate;
import morada.Repository.BookingRepository;
import morada.Types.BookingRequest;
import morada.Types.Decision;

public final class Approval {

    private Approval() {}

    public abstract static class Stage {

        private Stage next;

        // Returns the next stage, for chaining: a.andThen(b).andThen(c)
        public Stage andThen(Stage next) {
            this.next = next;
            return next;
        }

        public Decision evaluate(BookingRequest request) {
            String reason = check(request);
            if (reason != null) return new Decision(false, reason);
            return next != null ? next.evaluate(request) : Decision.approve();
        }

        // Each stage gives the reason for rejecting, or null if the request passed
        protected abstract String check(BookingRequest request);
    }

    public static class UnitInGoodStanding extends Stage {

        protected String check(BookingRequest request) {
            return request.unit().inArrears() ? "unit in arrears" : null;
        }
    }

    public static class MinimumNotice extends Stage {

        private final LocalDate today;

        public MinimumNotice(LocalDate today) {
            this.today = today;
        }

        protected String check(BookingRequest request) {
            int minimum = request.space().minNoticeDays();
            if (Types.daysBetween(today, request.date()) >= minimum) return null;
            return "minimum notice of " + minimum + " days";
        }
    }

    public static class SpaceAvailable extends Stage {

        private final BookingRepository bookings;

        public SpaceAvailable(BookingRepository bookings) {
            this.bookings = bookings;
        }

        protected String check(BookingRequest request) {
            boolean taken = bookings.isTaken(request.space().id(), request.date());
            return taken ? "space already booked on this date" : null;
        }
    }

    public static class MonthlyLimit extends Stage {

        private final BookingRepository bookings;

        public MonthlyLimit(BookingRepository bookings) {
            this.bookings = bookings;
        }

        protected String check(BookingRequest request) {
            long made = bookings.countInMonth(
                request.unit().id(),
                request.space().id(),
                request.date().substring(0, 7)
            );
            if (made < request.space().monthlyLimit()) return null;
            return "monthly booking limit reached";
        }
    }
}
