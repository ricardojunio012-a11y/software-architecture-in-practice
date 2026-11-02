// Tests: each pattern in isolation, with test doubles in place of the providers.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import morada.Approval.MinimumNotice;
import morada.Approval.UnitInGoodStanding;
import morada.Events.Event;
import morada.Events.EventBus;
import morada.Events.Subscriber;
import morada.Notification.ChannelFactory;
import morada.Notification.Email;
import morada.Notification.Message;
import morada.Notification.SimulatedProvider;
import morada.Notification.Sms;
import morada.Notification.WithLogging;
import morada.Notification.WithRetries;
import morada.State.Booking;
import morada.Types.BookingRequest;
import morada.Types.Decision;
import morada.Types.Resident;
import morada.Types.Space;
import morada.Types.Unit;
import org.junit.jupiter.api.Test;

class PatternsTest {

    static final Resident RESIDENT = new Resident(
        "David",
        "d@x.com",
        "sms",
        "+1",
        null
    );
    static final Space PARTY_ROOM = new Space("party-room", "Party room", 15000, 2, 1);

    static BookingRequest request(boolean inArrears, String date) {
        var unit = new Unit("A-1", inArrears, RESIDENT);
        return new BookingRequest("R-1", unit, PARTY_ROOM, date);
    }

    @Test
    void decoratorRetriesOutsideAndLoggingInside() {
        var provider = new SimulatedProvider(Map.of("+1", 2));
        List<String> log = new ArrayList<>();
        List<Long> waits = new ArrayList<>();
        var channel = new WithRetries(
            new WithLogging(new Sms(provider), log),
            3,
            (ms, who) -> waits.add(ms)
        );
        channel.send(RESIDENT, new Message("Test", "hello"));
        assertEquals(
            List.of(
                "sms to David: failed (provider unavailable)",
                "sms to David: failed (provider unavailable)",
                "sms to David: delivered (Test)"
            ),
            log
        );
        assertEquals(List.of(100L, 200L), waits); // growing wait
    }

    @Test
    void decoratorPermanentFailureIsNotRetried() {
        var provider = new SimulatedProvider(Map.of(), List.of("d@x.com"));
        List<String> log = new ArrayList<>();
        var channel = new WithRetries(
            new WithLogging(new Email(provider), log),
            3,
            (ms, who) -> {}
        );
        var error = assertThrows(IllegalStateException.class, () ->
            channel.send(RESIDENT, new Message("Test", "hello"))
        );
        assertTrue(error.getMessage().contains("without retry"));
        assertEquals(1, log.size());
    }

    @Test
    void stateTheBookingAcceptsOnlyItsStateTransitions() {
        var booking = new Booking(request(false, "2026-03-03"));
        booking.approve();
        booking.cancel();
        assertEquals("canceled", booking.state());
        var error = assertThrows(IllegalStateException.class, booking::approve);
        assertEquals("cannot approve a canceled booking", error.getMessage());
    }

    @Test
    void repositorySaveIfFreeRejectsTheSecondRequest() {
        var bookings = new Repository.InMemory();
        var first = new Booking(request(false, "2026-03-03"));
        assertTrue(bookings.saveIfFree(first));
        first.approve();
        assertFalse(bookings.saveIfFree(new Booking(request(false, "2026-03-03"))));
    }

    @Test
    void factoryPicksByChannelAndFallsBackToEmail() {
        var factory = new ChannelFactory(
            new SimulatedProvider(Map.of()),
            new ArrayList<>(),
            (ms, who) -> {}
        );
        assertEquals("sms", factory.forResident(RESIDENT).name());
        var pigeon = new Resident("David", "d@x.com", "carrier-pigeon", "+1", null);
        assertEquals("email", factory.forResident(pigeon).name());
    }

    @Test
    void chainTheFirstStageThatRejectsDecidesTheReason() {
        var chain = new UnitInGoodStanding();
        chain.andThen(new MinimumNotice(LocalDate.of(2026, 3, 2)));
        assertEquals(
            "unit in arrears",
            chain.evaluate(request(true, "2026-03-03")).reason()
        );
        assertEquals(
            "minimum notice of 2 days",
            chain.evaluate(request(false, "2026-03-03")).reason()
        );
        assertEquals(Decision.approve(), chain.evaluate(request(false, "2026-03-10")));
    }

    @Test
    void observerAFailingSubscriberDoesNotStopTheOthers() {
        var events = new EventBus();
        List<String> received = new ArrayList<>();
        events.subscribe(
            "BookingConfirmed",
            new Subscriber() {
                public String name() {
                    return "Broken";
                }

                public void handle(Event event) {
                    throw new IllegalStateException("out of service");
                }
            }
        );
        events.subscribe(
            "BookingConfirmed",
            new Subscriber() {
                public String name() {
                    return "FrontDesk";
                }

                public void handle(Event event) {
                    received.add(event.request().id());
                }
            }
        );
        events.publish(
            new Event("BookingConfirmed", request(false, "2026-03-10"), null)
        );
        assertEquals(List.of("R-1"), received);
        assertEquals(
            List.of("BookingConfirmed R-1: Broken: out of service"),
            events.failures
        );
    }
}
