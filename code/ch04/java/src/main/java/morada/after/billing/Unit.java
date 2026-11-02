// The data of one unit that the rules need.
package morada.after.billing;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record Unit(
    String id,
    long shareMillionths,
    Resident resident,
    boolean boardPresident,
    PastDue pastDue
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Resident(String name) {}

    public record PastDue(long amountCents, String dueDate) {}
}
