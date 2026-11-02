// One item of the charge. Conditional: it applies only to payment by the discount date.
package morada.after.billing;

import java.util.List;

public record Entry(String code, String description, long amount, boolean conditional) {
    public Entry(String code, String description, long amount) {
        this(code, description, amount, false);
    }

    public static long amountOf(List<Entry> posted, String code) {
        return posted
            .stream()
            .filter(e -> e.code().equals(code))
            .mapToLong(Entry::amount)
            .sum();
    }
}
