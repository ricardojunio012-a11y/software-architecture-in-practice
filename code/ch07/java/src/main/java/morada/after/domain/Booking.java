// Entity: it has an identity (the id) and a life cycle. It changes only through its
// own methods.
package morada.after.domain;

public class Booking {

    private final String id;
    private final String unit;
    private final TimeSlot slot;
    private final Money fee;
    private boolean confirmed = true;

    Booking(String id, String unit, TimeSlot slot, Money fee) {
        this.id = id;
        this.unit = unit;
        this.slot = slot;
        this.fee = fee;
    }

    public String id() {
        return id;
    }

    public String unit() {
        return unit;
    }

    public TimeSlot slot() {
        return slot;
    }

    public Money fee() {
        return fee;
    }

    public boolean isActive() {
        return confirmed;
    }

    // Only the schedule (same package) cancels: code outside cannot change the booking
    void cancel() {
        if (!confirmed) throw new DomainError("booking is not confirmed");
        confirmed = false;
    }
}
