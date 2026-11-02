// Tests: the home screen in one call, the idempotent batch, and the detected conflict.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.HashMap;
import java.util.List;
import morada.Backend.Bookings;
import morada.Backend.FrontDesk;
import morada.Backend.Guest;
import morada.Backend.Package;
import morada.StaffBff.Operation;
import org.junit.jupiter.api.Test;

class BffTest {

    static final Operation DELIVER = new Operation(
        "op-A1",
        "deliver",
        "09:00",
        "P-1",
        1,
        null,
        null
    );

    static StaffBff build() {
        return new StaffBff(
            new FrontDesk(List.of(new Package("P-1", "A-1"))),
            new Bookings(List.of(new Guest("Anna", "R-1", "party-room")))
        );
    }

    @Test
    void buildsTheHomeScreenInOneCall() {
        var screen = build().home();
        assertEquals("P-1", screen.pendingPackages().get(0).id());
        assertEquals("Anna", screen.expectedVisitors().get(0).name());
    }

    @Test
    void doesNotMistakeAVisitorForAnotherWhoseNameContainsTheirs() {
        var bff = new StaffBff(
            new FrontDesk(List.of()),
            new Bookings(
                List.of(
                    new Guest("Anna", "R-1", "party-room"),
                    new Guest("Mary Anna", "R-1", "party-room")
                )
            )
        );
        var visit = new Operation(
            "op-A1",
            "registerVisitor",
            "09:00",
            null,
            null,
            "Mary Anna",
            "R-1"
        );
        bff.sync("A", List.of(visit));
        var expected = bff.home().expectedVisitors();
        assertEquals(
            List.of("Anna"),
            expected
                .stream()
                .map(g -> g.name())
                .toList()
        );
    }

    @Test
    void withPersistedResultsRecognizesTheBatchAfterARestart() {
        var frontDesk = new FrontDesk(List.of(new Package("P-1", "A-1")));
        var bookings = new Bookings(List.of());
        var table = new HashMap<String, String>();
        new StaffBff(frontDesk, bookings, table).sync("A", List.of(DELIVER));
        var after = new StaffBff(frontDesk, bookings, table);
        var result = after.sync("A", List.of(DELIVER)).get(0).result();
        assertEquals("applied", result);
        assertEquals(1, after.repeated);
    }

    @Test
    void doesNotApplyAResentBatchTwice() {
        var bff = build();
        bff.sync("A", List.of(DELIVER));
        var result = bff.sync("A", List.of(DELIVER)).get(0).result();
        assertEquals("applied", result);
        assertEquals(1, bff.repeated);
    }

    @Test
    void reportsAConflictWhenThePackageChanged() {
        var bff = build();
        var giveBack = new Operation("op-B1", "return", "09:00", "P-1", 1, null, null);
        bff.sync("B", List.of(giveBack));
        var result = bff.sync("A", List.of(DELIVER)).get(0).result();
        assertEquals("conflict: P-1 already returned by tablet B at 09:00", result);
    }
}
