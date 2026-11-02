// Tests: each layer can be tested without the ones above it; the core, without real
// plugins.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.List;
import morada.layers.application.BookingService;
import morada.layers.data.ScheduleRepository;
import morada.layers.domain.Errors.RuleViolationError;
import morada.layers.domain.Schedule;
import morada.layers.domain.Schedule.Space;
import morada.layers.presentation.Api;
import morada.plugins.BankPlugin;
import morada.plugins.BankPlugin.Charge;
import morada.plugins.Core;
import org.junit.jupiter.api.Test;

class StylesTest {

    static final Space PARTY_ROOM = new Space("party-room", 15000, 2);

    @Test
    void theDomainRejectsAnOverlappingSlotWithoutKnowingHttpExists() {
        var schedule = new Schedule(PARTY_ROOM);
        schedule.book("R-1", "A-101", "2026-03-14", 14, 22, "2026-03-02");
        assertThrows(RuleViolationError.class, () ->
            schedule.book("R-2", "A-202", "2026-03-14", 20, 23, "2026-03-02")
        );
    }

    @Test
    void thePresentationLayerTurnsTheViolatedRuleInto409() throws Exception {
        var api = Api.create(
            new BookingService(new ScheduleRepository(List.of(PARTY_ROOM)))
        );
        api.start("127.0.0.1", 0);
        String body = """
        {"booking":"R-1","unit":"A-101","space":"party-room","date":"2026-03-03",
         "start":10,"end":12,"requestedOn":"2026-03-02"}""";
        var req = HttpRequest.newBuilder(
            URI.create("http://127.0.0.1:" + api.port() + "/bookings")
        )
            .POST(BodyPublishers.ofString(body))
            .build();
        var response = HttpClient.newHttpClient().send(req, BodyHandlers.ofString());
        api.stop();
        assertEquals(409, response.statusCode());
    }

    record FakePlugin(
        String name,
        java.util.function.Function<Charge, String> f
    ) implements BankPlugin {
        public String register(Charge c) {
            return f.apply(c);
        }
    }

    @Test
    void issuesThroughTheInstalledPluginAndReportsAMissingPlugin() {
        var core = new Core();
        core.install(new FakePlugin("test", c -> "T-" + c.unit()));
        assertEquals(
            "A-1;$1.00;test;T-A-1",
            core.issue(new Charge("A-1", 100, "test"))
        );
        assertEquals(
            "A-1;$1.00;zeta;no plugin for bank zeta",
            core.issue(new Charge("A-1", 100, "zeta"))
        );
    }

    @Test
    void aFaultyPluginDoesNotBringDownTheCore() {
        var core = new Core();
        core.install(
            new FakePlugin("broken", c -> {
                throw new IllegalStateException("out of service");
            })
        );
        assertEquals(
            "A-1;$1.00;broken;plugin broken failed: out of service",
            core.issue(new Charge("A-1", 100, "broken"))
        );
    }

    @Test
    void rejectsAPluginThatDoesNotFulfillTheContract() {
        var error = assertThrows(IllegalArgumentException.class, () ->
            new Core().install(new Object())
        );
        assertEquals("plugin does not fulfill the contract", error.getMessage());
    }
}
