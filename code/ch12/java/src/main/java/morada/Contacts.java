// Usage: java morada.Contacts <output-folder>
// The hard part of the extraction. To send a notice, Communications needs the
// resident's email, which belongs to the Directory and, in the monolith, came from
// a join with its table. Outside the monolith, with no shared table, there are two
// paths: query the Directory through its API on every notice, or keep a replica of
// the contacts, fed by the ContactChanged events. A simulated clock, in minutes,
// keeps the output the same on any machine.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class Contacts {

    record Change(int minute, String unit, String email) {}

    static List<Change> changes = new ArrayList<>();
    static int units, notices, from, to, lag;

    static String unitOf(int notice) {
        return String.format("U-%02d", ((notice - 1) % units) + 1);
    }

    static boolean directoryUp(int minute) {
        return minute < from || minute > to;
    }

    // A unit's email at a given minute, counting the changes already in effect
    static String emailAt(String unit, int minute, int copyLag) {
        String email =
            "resident." + unit.toLowerCase().replace("-", "") + "@example.com";
        for (Change c : changes) {
            if (c.unit().equals(unit) && c.minute() + copyLag <= minute) {
                email = c.email();
            }
        }
        return email;
    }

    // Path 1: on every notice, ask the Directory for the email. If it does not answer,
    // the notice waits in a local queue and goes out when the Directory comes back.
    static List<String> byLookup() {
        int calls = 0,
            errors = 0,
            rightAway = 0,
            longestDelay = 0;
        List<Integer> held = new ArrayList<>();
        for (int notice = 1; notice <= notices; notice++) {
            int minute = notice;
            if (directoryUp(minute)) {
                for (int queued : held) {
                    calls++;
                    longestDelay = Math.max(longestDelay, minute - queued);
                }
                held.clear();
            }
            calls++;
            if (!directoryUp(minute)) {
                errors++;
                held.add(minute);
                continue;
            }
            rightAway++;
        }
        String heldLine = String.format(
            "  notices held until the Directory came back: %d (longest delay: %d min)",
            errors,
            longestDelay
        );
        return List.of(
            "Querying the Directory API on every notice",
            "  calls to the Directory: " + calls + " (" + errors + " failed)",
            "  notices sent right away: " + rightAway,
            heldLine,
            // Each lookup reads the current email: no notice goes to an old address
            "  notices sent to an outdated email: 0"
        );
    }

    // Path 2: Communications keeps a copy of the contacts, loaded once and updated by
    // the events, which arrive a few minutes after the change
    static List<String> byReplica() {
        List<String> outdated = new ArrayList<>();
        for (int notice = 1; notice <= notices; notice++) {
            String unit = unitOf(notice);
            if (emailAt(unit, notice, lag).equals(emailAt(unit, notice, 0))) {
                continue;
            }
            Change last = null;
            for (Change x : changes) {
                if (x.unit().equals(unit) && x.minute() <= notice) last = x;
            }
            outdated.add(
                String.format(
                    "    E-P-%03d to %s: old email (changed at minute %d; in the replica, at %d)",
                    notice,
                    unit,
                    last.minute(),
                    last.minute() + lag
                )
            );
        }
        long applied = changes
            .stream()
            .filter(c -> c.minute() + lag <= notices)
            .count();
        List<String> lines = new ArrayList<>(
            List.of(
                String.format("Contacts replica fed by events (lag of %d min)", lag),
                "  initial load: " + units + " contacts",
                "  ContactChanged events applied: " + applied,
                "  calls to the Directory: 0",
                "  notices sent right away: " + notices,
                "  notices held until the Directory came back: 0",
                "  notices sent to an outdated email: " + outdated.size()
            )
        );
        lines.addAll(outdated);
        return lines;
    }

    public static void main(String[] args) throws Exception {
        JsonNode s = new ObjectMapper().readTree(
            Path.of("/data/input/contacts.json").toFile()
        );
        units = s.get("units").asInt();
        notices = s.get("notices").asInt();
        from = s.get("directoryDown").get("from").asInt();
        to = s.get("directoryDown").get("to").asInt();
        lag = s.get("replicaLag").asInt();
        for (JsonNode c : s.get("changes")) {
            changes.add(
                new Change(
                    c.get("minute").asInt(),
                    c.get("unit").asText(),
                    c.get("email").asText()
                )
            );
        }
        List<String> lines = new ArrayList<>(byLookup());
        lines.add("");
        lines.addAll(byReplica());
        Path folder = Path.of(args[0]).resolve("contacts");
        Files.createDirectories(folder);
        Files.writeString(
            folder.resolve("result.txt"),
            String.join("\n", lines) + "\n"
        );
        System.out.println("contacts: output in " + folder);
    }
}
