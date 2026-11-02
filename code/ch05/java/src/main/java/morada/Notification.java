// Strategy (the channels), Decorator (retries and logging) and Factory (the factory).
package morada;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import morada.Types.Resident;

public final class Notification {

    private Notification() {}

    public record Message(String title, String text) {}

    public interface Channel {
        String name();

        void send(Resident resident, Message message);
    }

    // A failure that may go away on a new attempt (provider down, rate limit)
    public static class TransientError extends RuntimeException {

        public TransientError(String message) {
            super(message);
        }
    }

    // A failure that repeats on every attempt (no such address, invalid number)
    public static class PermanentError extends RuntimeException {

        public PermanentError(String message) {
            super(message);
        }
    }

    // Who waits between attempts: in production, a timer; in the lab, a
    // simulated clock that only records the wait, so the output is always the same
    public interface Wait {
        void waitFor(long ms, String who);
    }

    // Simulates the email, push and SMS providers. Some destinations fail on the
    // first attempts, as real providers do, and others are invalid and always fail.
    public static class SimulatedProvider {

        private final Map<String, Integer> failures;
        private final Set<String> invalid;
        public final List<String> delivered = new ArrayList<>();

        public SimulatedProvider(Map<String, Integer> failures) {
            this(failures, List.of());
        }

        public SimulatedProvider(Map<String, Integer> failures, List<String> invalid) {
            this.failures = new HashMap<>(failures);
            this.invalid = new HashSet<>(invalid);
        }

        public void deliver(String channel, String destination, String text) {
            if (invalid.contains(destination)) {
                throw new PermanentError("no such address");
            }
            int remaining = failures.getOrDefault(destination, 0);
            if (remaining > 0) {
                failures.put(destination, remaining - 1);
                throw new TransientError("provider unavailable");
            }
            delivered.add(channel + " " + destination + " | " + text);
        }
    }

    // Each strategy knows the address and the format of its channel
    public record Email(SimulatedProvider provider) implements Channel {
        public String name() {
            return "email";
        }

        public void send(Resident resident, Message m) {
            provider.deliver(name(), resident.email(), m.title() + ": " + m.text());
        }
    }

    public record Push(SimulatedProvider provider) implements Channel {
        public String name() {
            return "push";
        }

        // The app notification shows the title apart from the text
        public void send(Resident resident, Message m) {
            String text = "[" + m.title() + "] " + m.text();
            provider.deliver(name(), resident.device(), text);
        }
    }

    public record Sms(SimulatedProvider provider) implements Channel {
        public String name() {
            return "sms";
        }

        // SMS is short: only the title, and the details stay in the app
        public void send(Resident resident, Message m) {
            provider.deliver(name(), resident.phone(), "Morada: " + m.title());
        }
    }

    // Decorator: logs each attempt without the channel knowing it is being watched
    public record WithLogging(Channel channel, List<String> log) implements Channel {
        public String name() {
            return channel.name();
        }

        public void send(Resident resident, Message message) {
            String who = name() + " to " + resident.name();
            try {
                channel.send(resident, message);
                log.add(who + ": delivered (" + message.title() + ")");
            } catch (RuntimeException error) {
                log.add(who + ": failed (" + error.getMessage() + ")");
                throw error;
            }
        }
    }

    // Decorator: tries again before giving up, only when the failure is transient,
    // and waits longer and longer between attempts (100 ms, 200 ms, 400 ms...)
    public record WithRetries(
        Channel channel,
        int attempts,
        Wait waiter,
        long initialWaitMs
    ) implements Channel {
        public WithRetries(Channel channel, int attempts, Wait waiter) {
            this(channel, attempts, waiter, 100);
        }

        public String name() {
            return channel.name();
        }

        public void send(Resident resident, Message message) {
            for (int attempt = 1; ; attempt++) {
                try {
                    channel.send(resident, message);
                    return;
                } catch (TransientError error) {
                    if (attempt == attempts) {
                        throw new IllegalStateException(
                            name() + " failed after " + attempt + " attempts"
                        );
                    }
                    long ms = initialWaitMs * (1L << (attempt - 1));
                    waiter.waitFor(ms, name() + " to " + resident.name());
                } catch (RuntimeException error) {
                    // Repeating a permanent failure only wastes time and provider quota
                    String reason = error.getMessage();
                    throw new IllegalStateException(
                        name() + " failed without retry (" + reason + ")"
                    );
                }
            }
        }
    }

    // Factory: picks the strategy from the resident's preference and wraps it in
    // the decorators. Whoever sends notices knows no concrete class.
    public static class ChannelFactory {

        private final Map<String, Channel> channels = new HashMap<>();
        private final List<String> log;
        private final Wait wait;

        public ChannelFactory(SimulatedProvider provider, List<String> log, Wait wait) {
            this.wait = wait;
            for (Channel c : List.of(
                new Email(provider),
                new Push(provider),
                new Sms(provider)
            )) {
                channels.put(c.name(), c);
            }
            this.log = log;
        }

        public Channel forResident(Resident resident) {
            Channel channel = channels.getOrDefault(
                resident.channel(),
                channels.get("email")
            );
            // The order matters: retries outside, logging inside
            return new WithRetries(new WithLogging(channel, log), 3, wait);
        }
    }
}
