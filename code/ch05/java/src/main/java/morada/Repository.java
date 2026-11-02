// Repository: whoever uses the bookings does not know where they are stored.
package morada;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import morada.State.Booking;
import morada.Types.BookingRequest;

public final class Repository {

    private Repository() {}

    public interface BookingRepository {
        void save(Booking booking);

        // Checks and saves in a single operation: in the database, a uniqueness constraint
        boolean saveIfFree(Booking booking);

        Optional<Booking> find(String id);

        boolean isTaken(String space, String date);

        long countInMonth(String unit, String space, String month);
    }

    // In memory for the lab; chapter 16 replaces it with a database.
    // Keeps every booking; the queries count only the approved ones.
    public static class InMemory implements BookingRepository {

        private final List<Booking> bookings = new ArrayList<>();

        public void save(Booking booking) {
            bookings.add(booking);
        }

        public boolean saveIfFree(Booking booking) {
            BookingRequest r = booking.request();
            if (isTaken(r.space().id(), r.date())) return false;
            save(booking);
            return true;
        }

        public Optional<Booking> find(String id) {
            return bookings
                .stream()
                .filter(b -> b.request().id().equals(id))
                .findFirst();
        }

        public boolean isTaken(String space, String date) {
            return approved().anyMatch(
                r -> r.space().id().equals(space) && r.date().equals(date)
            );
        }

        public long countInMonth(String unit, String space, String month) {
            return approved()
                .filter(r -> r.unit().id().equals(unit))
                .filter(r -> r.space().id().equals(space) && r.date().startsWith(month))
                .count();
        }

        private Stream<BookingRequest> approved() {
            return bookings
                .stream()
                .filter(b -> b.state().equals("approved"))
                .map(Booking::request);
        }
    }
}
