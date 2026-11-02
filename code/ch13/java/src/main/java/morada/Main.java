// Usage: java morada.Main online|offline|restart|persisted <output-folder>
// Simulates a morning at the front desk with two tablets. In the offline version,
// tablet A loses the internet, works from the local queue, and syncs when it comes back.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import morada.Backend.Bookings;
import morada.Backend.FrontDesk;
import morada.Backend.Guest;
import morada.Backend.Package;
import morada.Backend.Visitor;

public class Main {

    static String text(JsonNode node, String field) {
        return node.has(field) ? node.get(field).asText() : null;
    }

    public static void main(String[] args) throws Exception {
        String version = args[0];
        JsonNode scenario = new ObjectMapper().readTree(
            Path.of("/data/input/scenario.json").toFile()
        );
        List<Package> packages = new ArrayList<>();
        for (JsonNode p : scenario.get("packages")) {
            packages.add(new Package(text(p, "id"), text(p, "unit")));
        }
        List<Guest> guests = new ArrayList<>();
        for (JsonNode party : scenario.get("guests")) {
            for (JsonNode name : party.get("names")) {
                String booking = text(party, "booking");
                guests.add(new Guest(name.asText(), booking, text(party, "space")));
            }
        }
        var frontDesk = new FrontDesk(packages);
        var bookings = new Bookings(guests);
        // In the persisted version, the result of each operation goes to a table that
        // outlives the BFF process; in the others, it lives only in the BFF's memory
        Map<String, String> operationsTable = new HashMap<>();
        Supplier<StaffBff> newBff = () ->
            new StaffBff(
                frontDesk,
                bookings,
                version.equals("persisted") ? operationsTable : new HashMap<>()
            );
        StaffBff[] bff = { newBff.get() };
        List<String> log = new ArrayList<>();
        var tablets = Map.of(
            "A",
            new Tablet("A", () -> bff[0], log),
            "B",
            new Tablet("B", () -> bff[0], log)
        );

        for (JsonNode step : scenario.get("steps")) {
            if (step.has("only")) {
                boolean applies = false;
                for (JsonNode v : step.get("only"))
                    applies |= v.asText().equals(version);
                if (!applies) continue;
            }
            if (text(step, "action").equals("restartBff")) {
                bff[0] = newBff.get();
                log.add("the BFF restarted: what was only in its memory is gone");
                continue;
            }
            Tablet tablet = tablets.get(text(step, "tablet"));
            switch (text(step, "action")) {
                case "open" -> tablet.open();
                case "disconnect" -> tablet.disconnect();
                case "reconnect" -> tablet.reconnect(
                    step.get("loseResponse").asBoolean()
                );
                case "resend" -> tablet.resend();
                default -> tablet.operate(
                    text(step, "action"),
                    text(step, "time"),
                    text(step, "packageId"),
                    text(step, "name"),
                    text(step, "booking")
                );
            }
        }

        List<String> state = new ArrayList<>();
        for (Package p : frontDesk.packages.values()) {
            String base = p.id + " " + p.unit + ": " + p.status;
            state.add(
                p.by == null ? base : base + " by tablet " + p.by + " at " + p.time
            );
        }
        for (Visitor v : frontDesk.visitors) {
            String entered = " entered at " + v.time() + " on tablet " + v.tablet();
            state.add(v.name() + " (" + v.booking() + ")" + entered);
        }
        state.add("repeated operations ignored: " + bff[0].repeated);

        Path folder = Path.of(args[1], version);
        Files.createDirectories(folder);
        Files.writeString(folder.resolve("log.txt"), String.join("\n", log) + "\n");
        Files.writeString(folder.resolve("state.txt"), String.join("\n", state) + "\n");
        System.out.println(version + ": output in " + folder);
    }
}
