// Observer: whoever publishes an event does not know who reacts to it.
package morada;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import morada.Types.BookingRequest;

public final class Events {

    private Events() {}

    // type: "BookingConfirmed" or "BookingRejected"
    public record Event(String type, BookingRequest request, String reason) {}

    public interface Subscriber {
        String name();

        void handle(Event event);
    }

    public static class EventBus {

        private final Map<String, List<Subscriber>> subscribers = new HashMap<>();
        public final List<String> failures = new ArrayList<>();

        public void subscribe(String type, Subscriber subscriber) {
            subscribers.computeIfAbsent(type, t -> new ArrayList<>()).add(subscriber);
        }

        // A subscriber that fails does not stop the others from receiving the event
        public void publish(Event event) {
            for (Subscriber subscriber : subscribers.getOrDefault(
                event.type(),
                List.of()
            )) {
                try {
                    subscriber.handle(event);
                } catch (RuntimeException error) {
                    failures.add(
                        event.type() +
                            " " +
                            event.request().id() +
                            ": " +
                            subscriber.name() +
                            ": " +
                            error.getMessage()
                    );
                }
            }
        }
    }
}
