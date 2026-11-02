// Domain layer: the booking rules. It knows nothing about HTTP, JSON or databases.
package morada.layers.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import morada.layers.domain.Errors.NotFoundError;
import morada.layers.domain.Errors.RuleViolationError;

public class Schedule {

    public record Space(String id, long feeCents, int minNoticeDays) {}

    public record Booking(
        String id,
        String unit,
        String date,
        int start,
        int end,
        long feeCents
    ) {}

    private final Space space;
    private final List<Booking> bookings = new ArrayList<>();

    public Schedule(Space space) {
        this.space = space;
    }

    public Space space() {
        return space;
    }

    static long days(String from, String to) {
        return ChronoUnit.DAYS.between(LocalDate.parse(from), LocalDate.parse(to));
    }

    public Booking book(
        String id,
        String unit,
        String date,
        int start,
        int end,
        String today
    ) {
        if (end <= start) throw new RuleViolationError("invalid time slot");
        if (days(today, date) < space.minNoticeDays()) {
            throw new RuleViolationError("minimum notice not met");
        }
        for (Booking b : bookings) {
            if (b.date().equals(date) && b.start() < end && start < b.end()) {
                throw new RuleViolationError("time slot overlaps " + b.id());
            }
        }
        long base = space.feeCents();
        DayOfWeek day = LocalDate.parse(date).getDayOfWeek();
        boolean weekend = day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
        long fee = weekend ? base + (base * 20 + 50) / 100 : base;
        Booking booking = new Booking(id, unit, date, start, end, fee);
        bookings.add(booking);
        return booking;
    }

    // Returns the cancellation fee in cents: 50% of the fee if less than 2 days are left
    public long cancel(String id, String today) {
        Booking b = bookings
            .stream()
            .filter(x -> x.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new NotFoundError("booking not found"));
        bookings.remove(b);
        return days(today, b.date()) < 2 ? (b.feeCents() * 50 + 50) / 100 : 0;
    }

    public boolean has(String id) {
        return bookings.stream().anyMatch(b -> b.id().equals(id));
    }

    public List<Booking> bookings() {
        return List.copyOf(bookings);
    }
}
