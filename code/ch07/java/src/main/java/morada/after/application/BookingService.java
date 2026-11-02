// Application service: translates a command into calls to the domain. It loads the
// aggregate, asks it to do the work, saves it and publishes the events. No business rule.
package morada.after.application;

import java.util.function.Consumer;
import morada.after.domain.DomainError;
import morada.after.domain.DomainEvent;
import morada.after.domain.Schedule;
import morada.after.domain.TimeSlot;

public class BookingService {

    public record Command(
        String type,
        String booking,
        String requestedOn,
        String unit,
        String space,
        String date,
        int start,
        int end
    ) {}

    public record Result(
        String booking,
        String command,
        String status,
        String detail
    ) {}

    private final InMemorySchedules schedules;
    private final Consumer<DomainEvent> publish;

    public BookingService(InMemorySchedules schedules, Consumer<DomainEvent> publish) {
        this.schedules = schedules;
        this.publish = publish;
    }

    public Result execute(Command c) {
        try {
            return c.type().equals("book") ? book(c) : cancel(c);
        } catch (DomainError error) {
            String status = c.type().equals("book") ? "rejected" : "not canceled";
            return new Result(c.booking(), c.type(), status, error.getMessage());
        }
    }

    private Result book(Command c) {
        TimeSlot slot = new TimeSlot(c.date(), c.start(), c.end());
        Schedule schedule = schedules.forSpace(c.space());
        var booking = schedule.book(c.booking(), c.unit(), slot, c.requestedOn());
        save(schedule);
        return new Result(c.booking(), c.type(), "confirmed", booking.fee().toString());
    }

    private Result cancel(Command c) {
        Schedule schedule = schedules.forBooking(c.booking());
        var fee = schedule.cancel(c.booking(), c.requestedOn());
        save(schedule);
        String detail =
            fee.cents() > 0 ? "cancellation fee " + fee : "no cancellation fee";
        return new Result(c.booking(), c.type(), "canceled", detail);
    }

    private void save(Schedule schedule) {
        schedules.save(schedule);
        schedule.collectEvents().forEach(publish);
    }
}
