// Tests: what the anemic model allows and what the rich model prevents.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import morada.after.domain.DomainError;
import morada.after.domain.DomainEvent.BookingCanceled;
import morada.after.domain.Money;
import morada.after.domain.Schedule;
import morada.after.domain.Schedule.UsagePolicy;
import morada.after.domain.TimeSlot;
import morada.before.Model;
import org.junit.jupiter.api.Test;

class DomainTest {

    static final UsagePolicy POLICY = new UsagePolicy(new Money(15000), 2, 1);

    @Test
    void beforeAnyCodeCanSaveAnOverlappingBooking() {
        for (int[] h : new int[][] { { 14, 22 }, { 20, 23 } }) {
            var b = new Model.Booking();
            b.id = "X-" + h[0];
            b.space = "party-room";
            b.date = "2026-03-14";
            b.start = h[0];
            b.end = h[1];
            Model.bookings.add(b);
        }
        long overlapping = Model.bookings
            .stream()
            .filter(b -> b.id.startsWith("X-"))
            .count();
        assertEquals(2, overlapping); // the invalid state was accepted
    }

    @Test
    void afterTheScheduleRejectsAnOverlappingTimeSlot() {
        var schedule = new Schedule("party-room", POLICY);
        schedule.book("R-1", "A-101", new TimeSlot("2026-03-14", 14, 22), "2026-03-02");
        var error = assertThrows(DomainError.class, () ->
            schedule.book(
                "R-2",
                "A-202",
                new TimeSlot("2026-03-14", 20, 23),
                "2026-03-02"
            )
        );
        assertEquals("time slot overlaps R-1", error.getMessage());
    }

    @Test
    void afterThereIsNoTimeSlotThatEndsBeforeItStarts() {
        assertThrows(DomainError.class, () -> new TimeSlot("2026-03-14", 18, 16));
    }

    @Test
    void afterMoneyRoundsHalfUpAndIsComparedByValue() {
        assertEquals("$90.01", new Money(18001).percent(50).toString());
        assertEquals(new Money(9000), new Money(9000));
    }

    @Test
    void afterALastMinuteCancellationYieldsAFeeAndAnEvent() {
        var schedule = new Schedule("party-room", POLICY);
        schedule.book("R-1", "A-101", new TimeSlot("2026-03-14", 14, 22), "2026-03-02");
        schedule.collectEvents();
        assertEquals("$90.00", schedule.cancel("R-1", "2026-03-13").toString());
        var events = schedule.collectEvents();
        assertEquals(1, events.size());
        assertEquals(BookingCanceled.class, events.get(0).getClass());
        assertThrows(DomainError.class, () -> schedule.cancel("R-1", "2026-03-13"));
        var error = assertThrows(DomainError.class, () ->
            schedule.cancel("R-99", "2026-03-13")
        );
        assertEquals("booking not found", error.getMessage());
    }
}
