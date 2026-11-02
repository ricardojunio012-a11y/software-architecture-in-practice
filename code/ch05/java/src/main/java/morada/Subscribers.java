// Who reacts to the booking events. Each does one thing and knows none of the others.
package morada;

import static morada.Types.dollars;
import static morada.Types.usDate;

import java.util.List;
import morada.Events.Event;
import morada.Events.Subscriber;
import morada.Notification.ChannelFactory;
import morada.Notification.Message;

public final class Subscribers {

    private Subscribers() {}

    public record NotifyResident(ChannelFactory factory) implements Subscriber {
        public String name() {
            return "NotifyResident";
        }

        public void handle(Event event) {
            var r = event.request();
            String when = r.space().name() + " on " + usDate(r.date());
            String fee = dollars(r.space().feeCents());
            Message message = event.type().equals("BookingConfirmed")
                ? new Message("Booking confirmed", when + ". Usage fee: $" + fee + ".")
                : new Message("Booking rejected", when + ": " + event.reason() + ".");
            var resident = r.unit().resident();
            factory.forResident(resident).send(resident, message);
        }
    }

    public record ChargeUsageFee(List<String> fees) implements Subscriber {
        public String name() {
            return "ChargeUsageFee";
        }

        public void handle(Event event) {
            var r = event.request();
            String description =
                "Usage fee: " + r.space().name() + " on " + usDate(r.date());
            String amount = dollars(r.space().feeCents());
            fees.add(r.unit().id() + ";" + description + ";" + amount);
        }
    }

    public record NotifyFrontDesk(List<String> list) implements Subscriber {
        public String name() {
            return "NotifyFrontDesk";
        }

        public void handle(Event event) {
            var r = event.request();
            String who = r.unit().id() + " " + r.unit().resident().name();
            list.add(usDate(r.date()) + " " + r.space().name() + ": " + who);
        }
    }
}
