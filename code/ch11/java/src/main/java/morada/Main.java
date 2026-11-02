// Usage: java morada.Main in-memory|dual-write|outbox <output-folder>
// Billing confirms three payments; Bookings and Communications react to the event.
package morada;

import static morada.Events.eventFor;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import morada.Events.Payment;
import morada.Events.PaymentConfirmed;
import morada.infra.Broker;
import morada.infra.Database;
import morada.modules.Bookings;
import morada.modules.Bookings.Booking;
import morada.modules.Communications;

public class Main {

    record Scenario(List<Booking> bookings, List<Payment> payments) {}

    // The scenario has fields that Java does not use (such as each booking's payment)
    static final ObjectMapper JSON = new ObjectMapper().configure(
        DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
        false
    );
    static final List<String> execution = new ArrayList<>();
    static Bookings bookings;
    static final Communications communications = new Communications();

    public static void main(String[] args) throws Exception {
        String version = args[0];
        Scenario scenario = JSON.readValue(
            Path.of("/data/input/scenario.json").toFile(),
            Scenario.class
        );
        bookings = new Bookings(scenario.bookings());
        if (version.equals("in-memory")) runInMemory(scenario.payments());
        else runWithBroker(scenario.payments(), version.equals("outbox"));

        Path outDir = Path.of(args[1]);
        Files.createDirectories(outDir);
        List<String> consumption = new ArrayList<>(bookings.log);
        consumption.addAll(communications.log);
        List<String> result = new ArrayList<>(bookings.lines());
        result.addAll(communications.notices);
        write(outDir.resolve("execution.txt"), execution);
        write(outDir.resolve("consumption.txt"), consumption);
        write(outDir.resolve("result.txt"), result);
        System.out.println(version + ": output in " + outDir);
    }

    static void write(Path file, List<String> lines) throws Exception {
        Files.writeString(file, String.join("\n", lines) + "\n");
    }

    // In-memory bus: the subscribers run right away, in the same process
    static void runInMemory(List<Payment> payments) {
        for (Payment p : payments) {
            var e = eventFor(p);
            execution.add(
                p.payment() + " confirmed; " + e.event() + " delivered in memory"
            );
            bookings.onPaymentConfirmed(e);
            communications.onPaymentConfirmed(e);
        }
    }

    static void runWithBroker(List<Payment> payments, boolean withOutbox)
        throws Exception {
        Connection db = Database.connect();
        var broker = Broker.connect();
        Channel channel = broker.channel();
        for (Payment p : payments) {
            var e = eventFor(p);
            if (withOutbox) {
                Database.saveWithOutbox(db, p, e);
                execution.add(
                    p.payment() + " saved with " + e.event() + " in the outbox"
                );
                continue;
            }
            // Dual write: save to the database, then publish, in two separate steps
            Database.savePayment(db, p);
            if ("after-write".equals(p.failure())) {
                execution.add(
                    p.payment() + " saved; the process crashed before publishing"
                );
                continue;
            }
            Broker.publish(channel, e);
            execution.add(p.payment() + " saved; " + e.event() + " published");
        }
        if (withOutbox) {
            Set<String> crashBeforeMark = new HashSet<>();
            for (Payment p : payments) {
                if ("relay-before-mark".equals(p.failure())) {
                    crashBeforeMark.add("E-" + p.payment());
                }
            }
            runRelay(db, channel, crashBeforeMark);
            runRelay(db, channel, crashBeforeMark);
        }
        Broker.consumeAll(channel, Broker.QUEUES.get(0), bookings::onPaymentConfirmed);
        Broker.consumeAll(
            channel,
            Broker.QUEUES.get(1),
            communications::onPaymentConfirmed
        );
        broker.connection().close();
        db.close();
    }

    // The relay reads the outbox and publishes what is pending; it marks it published later
    static void runRelay(Connection db, Channel channel, Set<String> crashBefore)
        throws Exception {
        String sql =
            "SELECT id, event, payload FROM outbox WHERE NOT published ORDER BY id";
        try (var query = db.createStatement(); var rows = query.executeQuery(sql)) {
            while (rows.next()) {
                String event = rows.getString("event");
                var e = JSON.readValue(
                    rows.getString("payload"),
                    PaymentConfirmed.class
                );
                Broker.publish(channel, e);
                if (crashBefore.remove(event)) {
                    execution.add(
                        "relay published " + event + " and crashed before marking"
                    );
                    return;
                }
                try (
                    var mark = db.prepareStatement(
                        "UPDATE outbox SET published = true WHERE id = ?"
                    )
                ) {
                    mark.setInt(1, rows.getInt("id"));
                    mark.executeUpdate();
                }
                execution.add("relay published " + event);
            }
        }
    }
}
