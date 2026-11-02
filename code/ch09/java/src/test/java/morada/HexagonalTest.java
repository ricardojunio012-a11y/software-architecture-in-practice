// Tests: the core with no real adapter, the adapters with no real core, and the
// same contract checked against both repositories.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Stream;
import morada.adapters.inbound.Cli;
import morada.adapters.outbound.InMemorySchedules;
import morada.adapters.outbound.PostgresSchedules;
import morada.application.BookingService;
import morada.application.BookingUseCases;
import morada.application.BookingUseCases.BookingRequest;
import morada.application.ScheduleRepository;
import morada.domain.Errors.NotFoundError;
import morada.domain.Errors.RuleViolatedError;
import morada.domain.Schedule.Space;
import morada.main.Assemble;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class HexagonalTest {

    static final Space PARTY_ROOM = new Space("party-room", 15000, 2);

    static BookingRequest request(String id) {
        return new BookingRequest(
            id,
            "A-101",
            "party-room",
            "2026-03-14",
            14,
            22,
            "2026-03-02"
        );
    }

    @Test
    void theCoreBooksAndRejectsAnOverlapWithOnlyMemory() {
        var service = new BookingService(new InMemorySchedules(List.of(PARTY_ROOM)));
        assertEquals("$180.00", service.book(request("R-1")).fee());
        var error = assertThrows(RuleViolatedError.class, () ->
            service.book(request("R-2"))
        );
        assertEquals("time slot overlaps R-1", error.getMessage());
    }

    @Test
    void theCommandLineAdapterDoesNotNeedTheRealCore() {
        List<String> calls = new ArrayList<>();
        var fake = new BookingUseCases() {
            public List<ListedSpace> listSpaces() {
                return List.of();
            }

            public Confirmation book(BookingRequest r) {
                return null;
            }

            public Cancellation cancel(String booking, String requestedOn) {
                calls.add(booking + " " + requestedOn);
                return new Cancellation(booking, "canceled", "$0.00");
            }

            public List<ListedBooking> bookingsForSpace(String space) {
                return List.of();
            }
        };
        var result = Cli.execute(fake, new String[] { "cancel", "R-7", "2026-03-01" });
        assertEquals(List.of("R-7 2026-03-01"), calls);
        assertEquals(new Cli.Result("R-7 canceled, cancellation fee $0.00", 0), result);
    }

    // Without a database (while building the image), the PostgreSQL case is skipped
    static Stream<Arguments> repositories() {
        Supplier<ScheduleRepository> memory = () ->
            new InMemorySchedules(List.of(PARTY_ROOM));
        Supplier<ScheduleRepository> postgres = () -> {
            assumeTrue(System.getenv("DATABASE_URL") != null, "no database");
            try {
                var schedules = new PostgresSchedules(
                    Assemble.connect(),
                    List.of(PARTY_ROOM)
                );
                schedules.prepare();
                return schedules;
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        };
        return Stream.of(
            Arguments.of("in memory", memory),
            Arguments.of("PostgreSQL", postgres)
        );
    }

    // The same contract holds for any adapter of the outbound port
    @ParameterizedTest(name = "{0}")
    @MethodSource("repositories")
    void contractKeepsTheScheduleAndFindsItByBooking(
        String name,
        Supplier<ScheduleRepository> create
    ) {
        var schedules = create.get();
        var schedule = schedules.forSpace("party-room");
        schedule.book("R-1", "A-101", "2026-03-14", 14, 22, "2026-03-02");
        schedules.save(schedule);
        var ids = schedules
            .forBooking("R-1")
            .bookings()
            .stream()
            .map(b -> b.id())
            .toList();
        assertEquals(List.of("R-1"), ids);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("repositories")
    void contractReportsWhenTheBookingDoesNotExist(
        String name,
        Supplier<ScheduleRepository> create
    ) {
        var schedules = create.get();
        assertThrows(NotFoundError.class, () -> schedules.forBooking("R-9"));
    }
}
