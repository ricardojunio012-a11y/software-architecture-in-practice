// The data about a unit that billing needs.
package morada.after.charges;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Unit(
    String id,
    long shareMillionths,
    Resident resident,
    PastDue pastDue
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Resident(String name) {}

    public record PastDue(long amountCents, String dueDate) {}
}
