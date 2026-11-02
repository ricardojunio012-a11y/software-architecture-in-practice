// Application layer: the use cases. It takes plain data, calls the domain and the
// repository, and returns plain data. It does not know HTTP exists.
package morada.layers.application;

import static morada.layers.domain.Errors.dollars;

import java.util.List;
import morada.layers.data.ScheduleRepository;

public class BookingService {

    public record BookingRequest(
        String booking,
        String unit,
        String space,
        String date,
        Integer start,
        Integer end,
        String requestedOn
    ) {}

    public record ListedSpace(String id, String fee, int minNoticeDays) {}

    public record Confirmation(String booking, String status, String fee) {}

    public record Cancellation(String booking, String status, String cancellationFee) {}

    public record ListedBooking(String booking, String unit, String slot) {}

    private final ScheduleRepository schedules;

    public BookingService(ScheduleRepository schedules) {
        this.schedules = schedules;
    }

    static String hour(int h) {
        return String.format("%02d:00", h);
    }

    public List<ListedSpace> listSpaces() {
        return schedules
            .all()
            .stream()
            .map(s -> s.space())
            .map(s -> new ListedSpace(s.id(), dollars(s.feeCents()), s.minNoticeDays()))
            .toList();
    }

    public Confirmation book(BookingRequest r) {
        var schedule = schedules.forSpace(r.space());
        var b = schedule.book(
            r.booking(),
            r.unit(),
            r.date(),
            r.start(),
            r.end(),
            r.requestedOn()
        );
        return new Confirmation(b.id(), "confirmed", dollars(b.feeCents()));
    }

    public Cancellation cancel(String booking, String on) {
        long fee = schedules.forBooking(booking).cancel(booking, on);
        return new Cancellation(booking, "canceled", dollars(fee));
    }

    public List<ListedBooking> bookingsForSpace(String space) {
        return schedules
            .forSpace(space)
            .bookings()
            .stream()
            .map(b -> {
                String slot = b.date() + " " + hour(b.start()) + "-" + hour(b.end());
                return new ListedBooking(b.id(), b.unit(), slot);
            })
            .toList();
    }
}
