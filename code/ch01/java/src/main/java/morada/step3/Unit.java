// The data of a unit, as it comes from the directory.
package morada.step3;

public record Unit(
    String id,
    long shareMillionths,
    Resident resident,
    String paymentMethod,
    PastDue pastDue // null when there is no past-due balance
) {
    public record Resident(String name, String email, String phone, String channel) {}

    public record PastDue(long amountCents, String dueDate) {}
}
