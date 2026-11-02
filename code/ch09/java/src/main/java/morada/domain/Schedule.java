// The center of the hexagon: the booking rules. Imports nothing outside the domain.
package morada.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import morada.domain.Errors.NotFoundError;
import morada.domain.Errors.RuleViolatedError;

public class Schedule {

    public record Space(String id, long feeCents, int minNoticeDays) {}

    public record Booking(
        String id,
        String unit,
        String date,
        int start,
        int end,
        long feeCents
    ) {
        // 2026-03-14 14:00-22:00
        public String slot() {
            return String.format("%s %02d:00-%02d:00", date, start, end);
        }
    }

    private final Space space;
    private final List<Booking> bookings;

    public Schedule(Space space) {
        this(space, List.of());
    }

    // A repository that loads a saved schedule passes in the existing bookings
    public Schedule(Space space, List<Booking> bookings) {
        this.space = space;
        this.bookings = new ArrayList<>(bookings);
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
        if (end <= start) throw new RuleViolatedError("invalid time slot");
        if (days(today, date) < space.minNoticeDays()) {
            throw new RuleViolatedError("minimum notice not met");
        }
        for (Booking b : bookings) {
            if (b.date().equals(date) && b.start() < end && start < b.end()) {
                throw new RuleViolatedError("time slot overlaps " + b.id());
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

    // Returns the cancellation fee in cents: 50% of the fee if less than 2 days remain
    public long cancel(String id, String today) {
        Booking b = bookings
            .stream()
            .filter(x -> x.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new NotFoundError("booking not found"));
        bookings.remove(b);
        return days(today, b.date()) < 2 ? (b.feeCents() * 50 + 50) / 100 : 0;
    }

    // In date and time order, whatever the order in which they were stored
    public List<Booking> bookings() {
        return bookings
            .stream()
            .sorted(Comparator.comparing(Booking::date).thenComparing(Booking::start))
            .toList();
    }
}
