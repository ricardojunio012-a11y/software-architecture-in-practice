// Aggregate: the schedule of a space is the consistency boundary. The rules that
// involve several bookings (no overlaps, a limit per unit) can only be guaranteed by
// whoever knows all of them. Nobody outside changes a booking without going through here.
package morada.after.domain;

import java.util.ArrayList;
import java.util.List;
import morada.after.domain.DomainEvent.BookingCanceled;
import morada.after.domain.DomainEvent.BookingConfirmed;

public class Schedule {

    public record UsagePolicy(Money fee, int minNoticeDays, int monthlyLimit) {}

    private static final long WEEKEND_SURCHARGE_PERCENT = 20;
    private static final long CANCELLATION_FEE_PERCENT = 50;
    private static final long FREE_CANCELLATION_DAYS = 2;

    private final String space;
    private final UsagePolicy policy;
    private final List<Booking> bookings = new ArrayList<>();
    private List<DomainEvent> events = new ArrayList<>();

    public Schedule(String space, UsagePolicy policy) {
        this.space = space;
        this.policy = policy;
    }

    public String space() {
        return space;
    }

    public Booking book(String id, String unit, TimeSlot slot, String today) {
        if (slot.daysSince(today) < policy.minNoticeDays()) {
            throw new DomainError("minimum notice not met");
        }
        for (Booking b : active()) {
            if (b.slot().overlaps(slot)) {
                throw new DomainError("time slot overlaps " + b.id());
            }
        }
        long thisMonth = active()
            .stream()
            .filter(b -> b.unit().equals(unit))
            .filter(b -> b.slot().month().equals(slot.month()))
            .count();
        if (thisMonth >= policy.monthlyLimit()) {
            throw new DomainError("unit's monthly limit reached");
        }
        Booking booking = new Booking(id, unit, slot, feeFor(slot));
        bookings.add(booking);
        events.add(new BookingConfirmed(id, space, slot, unit, booking.fee()));
        return booking;
    }

    public Money cancel(String id, String today) {
        Booking booking = bookings
            .stream()
            .filter(b -> b.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new DomainError("booking not found"));
        booking.cancel();
        boolean lastMinute = booking.slot().daysSince(today) < FREE_CANCELLATION_DAYS;
        Money cancellationFee = lastMinute
            ? booking.fee().percent(CANCELLATION_FEE_PERCENT)
            : Money.ZERO;
        events.add(new BookingCanceled(id, cancellationFee));
        return cancellationFee;
    }

    public boolean has(String id) {
        return bookings.stream().anyMatch(b -> b.id().equals(id));
    }

    public List<Booking> active() {
        return bookings.stream().filter(Booking::isActive).toList();
    }

    // Whoever saves the aggregate collects the events to publish them afterward
    public List<DomainEvent> collectEvents() {
        List<DomainEvent> collected = events;
        events = new ArrayList<>();
        return collected;
    }

    private Money feeFor(TimeSlot slot) {
        Money fee = policy.fee();
        if (!slot.isWeekend()) return fee;
        return fee.add(fee.percent(WEEKEND_SURCHARGE_PERCENT));
    }
}
