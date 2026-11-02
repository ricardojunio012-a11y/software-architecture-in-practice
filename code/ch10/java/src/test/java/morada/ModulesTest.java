// Tests: each module tested through its own API, Bookings tested without Billing, and
// the architecture rules checked on both versions.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import java.util.List;
import morada.after.modules.billing.Billing;
import morada.after.modules.billing.internal.ChargesTable;
import morada.after.modules.bookings.Bookings;
import morada.after.modules.bookings.Bookings.RejectionError;
import org.junit.jupiter.api.Test;

class ModulesTest {

    @Test
    void installmentPlanKeepsTheUnitInGoodStanding() {
        var billing = new Billing(new ChargesTable());
        billing.issue("C-1", "B-101", 58685, "2026-02-10");
        assertFalse(billing.unitInGoodStanding("B-101", "2026-03-02"));
        billing.split("C-1", 3);
        assertTrue(billing.unitInGoodStanding("B-101", "2026-03-02"));
    }

    @Test
    void rejectsUnitInArrearsWithAFakeBilling() {
        var bookings = new Bookings(List.of("party-room"), (unit, today) -> false);
        assertThrows(RejectionError.class, () ->
            bookings.book("R-1", "A-1", "party-room", "2026-03-14", "2026-03-02")
        );
    }

    @Test
    void doesNotAcceptTwoBookingsOfTheSameSpaceOnTheSameDay() {
        var bookings = new Bookings(List.of("party-room"), (unit, today) -> true);
        bookings.book("R-1", "A-1", "party-room", "2026-03-14", "2026-03-02");
        var error = assertThrows(RejectionError.class, () ->
            bookings.book("R-2", "A-2", "party-room", "2026-03-14", "2026-03-02")
        );
        assertEquals("party-room already booked on 2026-03-14", error.getMessage());
    }

    @Test
    void afterKeepsTheBoundariesAndBeforeDoesNot() {
        var after = new ClassFileImporter().importPackages("morada.after");
        Architecture.rules("after").forEach(rule -> rule.check(after));
        var before = new ClassFileImporter().importPackages("morada.before");
        assertTrue(Architecture.rules("before").get(0).evaluate(before).hasViolation());
    }
}
