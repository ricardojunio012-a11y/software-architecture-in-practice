// The sprout class tests: the new rule is tested alone, without the legacy code.
package morada;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import morada.step6.MonthlyLimit;
import morada.step6.MonthlyLimit.Booking;
import org.junit.jupiter.api.Test;

class MonthlyLimitTest {

    final MonthlyLimit limit = new MonthlyLimit();

    static Booking partyRoom(String unit, String date) {
        return new Booking(unit, "party-room", date);
    }

    static Booking grill(String date) {
        return new Booking("A-101", "grill-area", date);
    }

    @Test
    void declinesASecondPartyRoomBookingInTheSameMonth() {
        var made = List.of(partyRoom("A-101", "2026-03-14"));
        assertTrue(limit.reached(partyRoom("A-101", "2026-03-28"), made));
    }

    @Test
    void doesNotCountAnotherMonthAnotherUnitOrAnotherSpace() {
        var made = List.of(
            partyRoom("A-101", "2026-02-28"),
            partyRoom("B-101", "2026-03-14"),
            grill("2026-03-07")
        );
        assertFalse(limit.reached(partyRoom("A-101", "2026-03-28"), made));
    }

    @Test
    void grillAreaAllowsTwoAndSpaceWithNoLimitAllowsAll() {
        var two = List.of(grill("2026-03-07"), grill("2026-03-14"));
        assertFalse(limit.reached(grill("2026-03-21"), two.subList(0, 1)));
        assertTrue(limit.reached(grill("2026-03-21"), two));
        var pool = new Booking("A-101", "pool", "2026-03-21");
        assertFalse(limit.reached(pool, List.of(pool, pool)));
    }
}
