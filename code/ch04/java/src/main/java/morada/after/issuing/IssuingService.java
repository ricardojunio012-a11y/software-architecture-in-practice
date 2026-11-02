// Controller (GRASP): coordinates the calculation and the registration without doing
// either. Depends on abstractions passed to the constructor (dependency injection).
package morada.after.issuing;

import java.util.List;
import morada.after.billing.Charge;
import morada.after.billing.ChargeCalculator;
import morada.after.billing.Unit;
import morada.after.issuing.PaymentGateway.Deadlines;
import morada.after.issuing.PaymentGateway.Registration;

public class IssuingService {

    public record Result(List<Charge> charges, List<Registration> registrations) {}

    private final ChargeCalculator calculator;
    private final PaymentGateway gateway;
    private final Deadlines deadlines;

    public IssuingService(
        ChargeCalculator calculator,
        PaymentGateway gateway,
        Deadlines deadlines
    ) {
        this.calculator = calculator;
        this.gateway = gateway;
        this.deadlines = deadlines;
    }

    public Result issue(List<Unit> units) {
        List<Charge> charges = units.stream().map(calculator::calculate).toList();
        List<Registration> registrations = charges
            .stream()
            .map(c -> gateway.register(c, deadlines))
            .toList();
        return new Result(charges, registrations);
    }
}
