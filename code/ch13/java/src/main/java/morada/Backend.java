// The Morada back end (the monolith): Front Desk handles packages and visitors;
// Bookings knows who the guests of each party are. Neither one knows about screens.
package morada;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Backend {

    private Backend() {}

    public static class Package {

        public final String id;
        public final String unit;
        public String status = "at front desk";
        public int version = 1;
        public String by;
        public String time;

        public Package(String id, String unit) {
            this.id = id;
            this.unit = unit;
        }
    }

    public record Guest(String name, String booking, String space) {}

    public record Visitor(String name, String booking, String tablet, String time) {}

    public static class FrontDesk {

        public final Map<String, Package> packages = new LinkedHashMap<>();
        public final List<Visitor> visitors = new ArrayList<>();

        public FrontDesk(List<Package> initial) {
            for (Package p : initial) packages.put(p.id, p);
        }

        // Optimistic concurrency: changes only if nobody changed it since the seen version
        public String change(
            String id,
            String status,
            int seenVersion,
            String tablet,
            String time
        ) {
            Package p = packages.get(id);
            if (p.version != seenVersion) {
                String by = " by tablet " + p.by + " at " + p.time;
                return "conflict: " + id + " already " + p.status + by;
            }
            p.status = status;
            p.version++;
            p.by = tablet;
            p.time = time;
            return "applied";
        }

        public String registerVisitor(
            String name,
            String booking,
            String tablet,
            String time
        ) {
            visitors.add(new Visitor(name, booking, tablet, time));
            return "applied";
        }
    }

    public static class Bookings {

        private final List<Guest> guests;

        public Bookings(List<Guest> guests) {
            this.guests = List.copyOf(guests);
        }

        public List<Guest> guests() {
            return guests;
        }
    }
}
