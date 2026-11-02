// The front-desk staff app, on the tablet. Offline, it keeps the operations in a local
// queue and keeps working; on reconnect, it sends the queue to the BFF and shows the
// conflicts.
package morada;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import morada.StaffBff.Operation;

public class Tablet {

    private final String name;
    private final Supplier<StaffBff> connect;
    private final List<String> log;
    private final Map<String, Integer> versions = new HashMap<>();
    private final List<Operation> queue = new ArrayList<>();
    private boolean online = true;
    private int counter = 0;

    public Tablet(String name, Supplier<StaffBff> connect, List<String> log) {
        this.name = name;
        this.connect = connect;
        this.log = log;
    }

    // The tablet talks to the BFF's address, whatever process is serving it
    private StaffBff bff() {
        return connect.get();
    }

    private void note(String text) {
        log.add("tablet " + name + " " + text);
    }

    public void open() {
        var screen = bff().home();
        screen.pendingPackages().forEach(p -> versions.put(p.id(), p.version()));
        String pending = screen
            .pendingPackages()
            .stream()
            .map(p -> p.id())
            .collect(Collectors.joining(", "));
        String expected = screen
            .expectedVisitors()
            .stream()
            .map(v -> v.name())
            .collect(Collectors.joining(", "));
        String visitors = "], expected visitors [" + expected + "]";
        note("opened: packages [" + pending + visitors);
    }

    public void disconnect() {
        online = false;
        note("lost the internet");
    }

    public void operate(
        String type,
        String time,
        String packageId,
        String visitorName,
        String booking
    ) {
        counter++;
        var op = new Operation(
            "op-" + name + counter,
            type,
            time,
            packageId,
            packageId == null ? null : versions.get(packageId),
            visitorName,
            booking
        );
        if (!online) {
            queue.add(op);
            note("stored " + describe(op) + " in the local queue");
            return;
        }
        String result = bff().sync(name, List.of(op)).get(0).result();
        note("sent " + describe(op) + ": " + result);
    }

    // On reconnect, the queue goes as a batch, and the response may be lost on the way
    public void reconnect(boolean loseResponse) {
        online = true;
        var results = bff().sync(name, queue);
        if (loseResponse) {
            int n = queue.size();
            note("came back and sent " + n + " operations; the response was lost");
            return;
        }
        show("sent", results);
    }

    // Without a response, the tablet does not know what was applied: it resends the batch
    public void resend() {
        show("resent", bff().sync(name, queue));
    }

    private void show(String verb, List<StaffBff.Result> results) {
        note(verb + " " + queue.size() + " operations:");
        for (var r : results) {
            log.add("  " + describe(r.operation()) + ": " + r.result());
        }
        queue.clear();
    }

    private static String describe(Operation op) {
        String target = op.packageId() != null ? op.packageId() : op.name();
        return op.id() + " (" + op.type() + " " + target + ")";
    }
}
