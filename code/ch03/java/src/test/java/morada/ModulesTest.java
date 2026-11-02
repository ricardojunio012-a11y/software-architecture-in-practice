// Tests: the hidden coupling of "before" and the isolation of "after".
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import morada.after.charges.Charge;
import morada.after.charges.Charges;
import morada.after.charges.Unit;
import morada.after.delinquency.Delinquency;
import morada.before.config.Config;
import morada.before.services.Services;
import org.junit.jupiter.api.Test;

class ModulesTest {

    static final LocalDate TODAY = LocalDate.of(2026, 3, 2);

    // A small community in the test itself: the tests run when the image is built
    static final String DATA = """
    {"community": {"id": "t", "name": "Test", "monthlyExpensesCents": 485000},
     "units": [
       {"id": "A-101", "shareMillionths": 500000, "resident": {"name": "Anna"},
        "pastDue": null},
       {"id": "A-102", "shareMillionths": 250000, "resident": {"name": "Brian"},
        "pastDue": {"amountCents": 59400, "dueDate": "2026-01-10"}},
       {"id": "A-201", "shareMillionths": 250000, "resident": {"name": "Carol"},
        "pastDue": {"amountCents": 66750, "dueDate": "2026-02-10"}}],
     "expenses": [], "reserveFundOpeningBalanceCents": 0}
    """;

    @Test
    void beforeDelinquencyReordersAnotherModulesCharges() throws Exception {
        Services.charges.clear();
        Config.today = TODAY;
        Config.data = new ObjectMapper().readTree(DATA);
        Services.calculateAll();
        String originalOrder = order(
            Services.charges
                .stream()
                .map(c -> c.unit.get("id").asText())
                .toList()
        );
        Services.generateOutput("delinquency");
        String orderAfter = order(
            Services.charges
                .stream()
                .map(c -> c.unit.get("id").asText())
                .toList()
        );
        assertNotEquals(originalOrder, orderAfter);
    }

    @Test
    void afterDelinquencyDoesNotChangeTheCharges() throws Exception {
        List<Charge> list = Charges.calculate(485000, units(), TODAY);
        String before = order(list.stream().map(Charge::unit).toList());
        Delinquency.report("Test", TODAY, list);
        assertEquals(before, order(list.stream().map(Charge::unit).toList()));
    }

    @Test
    void afterCalculatesLateChargesWithoutGlobalConfiguration() throws Exception {
        Charge carol = Charges.calculate(485000, List.of(units().get(2)), TODAY).get(0);
        assertEquals(
            List.of(20L, 1335L, 445L),
            List.of(carol.daysLate(), carol.lateFee(), carol.interest())
        );
    }

    static List<Unit> units() throws Exception {
        var mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(DATA);
        return mapper.readerForListOf(Unit.class).readValue(root.get("units"));
    }

    static String order(List<String> ids) {
        return String.join(",", ids);
    }
}
