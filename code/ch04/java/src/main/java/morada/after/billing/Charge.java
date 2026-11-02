// The charge of one unit. Information expert (GRASP): whoever has the entries is the
// one who calculates the totals.
package morada.after.billing;

import java.util.List;

public record Charge(String unit, String resident, List<Entry> entries) {
    public Charge {
        entries = List.copyOf(entries);
    }

    public long total() {
        return sum(false);
    }

    // Conditional discount, as a positive amount
    public long discount() {
        return -sum(true);
    }

    private long sum(boolean conditional) {
        return entries
            .stream()
            .filter(e -> e.conditional() == conditional)
            .mapToLong(Entry::amount)
            .sum();
    }
}
