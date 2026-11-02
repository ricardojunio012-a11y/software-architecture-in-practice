// The use cases implement the inbound port and use the outbound port. They do not know
// whether HTTP or the terminal called them, nor where the schedules are kept.
package morada.application;

import static morada.domain.Errors.dollars;

import java.util.List;

public class BookingService implements BookingUseCases {

    private final ScheduleRepository schedules;

    public BookingService(ScheduleRepository schedules) {
        this.schedules = schedules;
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
        schedules.save(schedule);
        return new Confirmation(b.id(), "confirmed", dollars(b.feeCents()));
    }

    public Cancellation cancel(String booking, String requestedOn) {
        var schedule = schedules.forBooking(booking);
        long fee = schedule.cancel(booking, requestedOn);
        schedules.save(schedule);
        return new Cancellation(booking, "canceled", dollars(fee));
    }

    public List<ListedBooking> bookingsForSpace(String space) {
        return schedules
            .forSpace(space)
            .bookings()
            .stream()
            .map(b -> new ListedBooking(b.id(), b.unit(), b.slot()))
            .toList();
    }
}
