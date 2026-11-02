// Tests of the scenario runner: they check the load and the evaluation, not the time.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import morada.billing.Unit;
import org.junit.jupiter.api.Test;

class ScenariosTest {

    @Test
    void createsTheUnitsWithSharesThatAddUpToTheCommunity() {
        var units = Scenarios.syntheticCommunity(1, 40).units();
        assertEquals(40, units.size());
        assertEquals(1000000, units.stream().mapToLong(Unit::shareMillionths).sum());
        assertEquals(
            5,
            units
                .stream()
                .filter(u -> u.pastDue() != null)
                .count()
        );
    }

    @Test
    void passesWithinTheLimitAndFailsAboveIt() {
        assertTrue(Scenarios.evaluate(59.9, 60));
        assertFalse(Scenarios.evaluate(60.1, 60));
    }

    @Test
    void estimatesInvoiceCreationFromTheProcessorCapacity() {
        var scenario = new Scenarios.Scenario("T", "test", 3, 10, 10, 2);
        var r = Scenarios.run(scenario, LocalDate.of(2026, 3, 2));
        assertEquals(30, r.charges());
        assertEquals(3.0, r.processorSeconds());
        assertFalse(r.passed()); // 3 s at the processor do not fit in 2 s
    }
}
