// Sprout class (Feathers): the new rule is born outside the legacy code, in a new,
// small class with its own tests. The legacy code only gains a call.
package morada.step6;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;

public final class MonthlyLimit {

    // Bookings per unit, per space, in the same month
    public static final Map<String, Integer> DEFAULT = Map.of(
        "party-room",
        1,
        "grill-area",
        2
    );

    public record Booking(String unit, String space, String date) {}

    private final Map<String, Integer> limits;

    public MonthlyLimit() {
        this(DEFAULT);
    }

    public MonthlyLimit(Map<String, Integer> limits) {
        this.limits = limits;
    }

    public boolean reached(Booking request, List<Booking> approved) {
        Integer limit = limits.get(request.space());
        if (limit == null) return false;
        String month = request.date().substring(0, 7);
        long made = approved
            .stream()
            .filter(
                b ->
                    b.unit().equals(request.unit()) &&
                    b.space().equals(request.space()) &&
                    b.date().startsWith(month)
            )
            .count();
        return made >= limit;
    }

    // The entry point for the legacy code, which works with loose JSON
    public boolean reached(JsonNode request, List<JsonNode> approved) {
        return reached(of(request), approved.stream().map(MonthlyLimit::of).toList());
    }

    static Booking of(JsonNode r) {
        return new Booking(
            r.get("unit").asText(),
            r.get("space").asText(),
            r.get("date").asText()
        );
    }
}
