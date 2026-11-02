// Characterization tests: they describe what the code does today, including what
// may be wrong. Changing the behavior is another step, with another commit.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import morada.step5.Bookings;
import morada.step5.Bookings.Request;
import morada.step5.Bookings.Space;
import morada.step5.Bookings.Unit;
import org.junit.jupiter.api.Test;

class BookingsTest {

    static final LocalDate TODAY = LocalDate.of(2026, 3, 2);
    static final Space PARTY_ROOM = new Space("party-room", 15000);

    // Runs only in "tests", with /data mounted; during the image build, it is skipped
    @Test
    void theOutputIsIdenticalToTheApprovedResult() throws Exception {
        assumeTrue(Files.exists(Path.of("/data/expected/bookings.txt")));
        var data = new ObjectMapper().readValue(
            Path.of("/data/input/bookings.json").toFile(),
            Bookings.Data.class
        );
        var decisions = Bookings.decide(data, TODAY);
        List<String> emails = Bookings.notices(decisions)
            .stream()
            .map(n -> "to " + n.to() + ": " + n.text())
            .toList();
        assertEquals(
            Files.readString(Path.of("/data/expected/bookings.txt")),
            String.join("\n", Bookings.report(decisions)) + "\n"
        );
        assertEquals(
            Files.readString(Path.of("/data/expected/emails.txt")),
            String.join("\n", emails) + "\n"
        );
    }

    @Test
    void sundayHasNoWeekendSurchargeCurrentBehavior() {
        var sunday = new Request("R", "A", "party-room", "2026-03-15", 1);
        var saturday = new Request("R", "A", "party-room", "2026-03-14", 1);
        assertEquals(15000, Bookings.bookingAmount(PARTY_ROOM, sunday));
        assertEquals(18000, Bookings.bookingAmount(PARTY_ROOM, saturday));
    }

    @Test
    void theFirstRuleThatFailsDecidesTheReason() {
        var request = new Request("R", "A", "party-room", "2026-03-03", 1);
        var inArrears = new Unit("A", "a@x.com", true);
        assertEquals(
            "arrears",
            Bookings.declineReason(request, inArrears, TODAY, List.of())
        );
        var upToDate = new Unit("A", "a@x.com", false);
        assertEquals(
            "short notice",
            Bookings.declineReason(request, upToDate, TODAY, List.of())
        );
    }
}
