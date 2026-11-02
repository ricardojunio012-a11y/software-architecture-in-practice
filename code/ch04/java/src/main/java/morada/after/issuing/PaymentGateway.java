// The abstraction belongs to Morada, not to the providers: issuing is what says what
// it needs. Each provider gets an adapter that implements this interface.
package morada.after.issuing;

import morada.after.billing.Charge;

public interface PaymentGateway {
    record Deadlines(String dueDate, String discountUntil) {}

    record Registration(String unit, String identifier) {}

    String name();

    Registration register(Charge charge, Deadlines deadlines);
}
