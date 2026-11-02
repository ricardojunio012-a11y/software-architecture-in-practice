// Tests: what the before version cannot test and what the after version isolates.
// The data lives in the test, because the tests also run when the image is built.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import morada.after.billing.Charge;
import morada.after.billing.ChargeCalculator;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.after.billing.rules.BoardPresidentExemption;
import morada.after.billing.rules.EarlyPaymentDiscount;
import morada.after.billing.rules.MonthlyDues;
import morada.after.billing.rules.PastDueBalance;
import morada.after.billing.rules.ReserveFund;
import morada.after.issuing.IssuingService;
import morada.after.issuing.PaymentGateway;
import morada.before.Issuing;
import morada.external.AlphaBankClient;
import org.junit.jupiter.api.Test;

class IssuingTest {

    static final String DATA = """
    {
      "community": { "name": "Garden Court Condominiums", "monthlyExpensesCents": 485000 },
      "units": [
        { "id": "A-101", "shareMillionths": 125000,
          "resident": { "name": "Anna Scott" }, "pastDue": null },
        { "id": "A-201", "shareMillionths": 125000,
          "resident": { "name": "Carol Miller" },
          "pastDue": { "amountCents": 66750, "dueDate": "2026-02-10" } },
        { "id": "B-201", "shareMillionths": 140000, "boardPresident": true,
          "resident": { "name": "Grace Turner" }, "pastDue": null }
      ],
      "policy": { "reserveFundPercent": 10, "lateFeePercent": 2,
        "monthlyInterestPercent": 1, "earlyDiscountPercent": 5,
        "discountByDay": 5, "dueDay": 10 }
    }
    """;
    static final long EXPENSES = 485000;
    static final ObjectMapper JSON = new ObjectMapper();

    // Test double: implements the interface and only records what it received
    static class InMemoryGateway implements PaymentGateway {

        final List<Charge> received = new ArrayList<>();

        public String name() {
            return "in memory";
        }

        public Registration register(Charge charge, Deadlines deadlines) {
            received.add(charge);
            return new Registration(charge.unit(), "test");
        }
    }

    static List<Unit> units() throws Exception {
        var type = JSON.getTypeFactory().constructCollectionType(
            List.class,
            Unit.class
        );
        return JSON.readValue(JSON.readTree(DATA).get("units").traverse(), type);
    }

    @Test
    void beforeCalculatingTheChargesAlsoCreatesInvoicesAtTheBank() throws Exception {
        int before = AlphaBankClient.issued;
        Issuing.issueCharges(JSON.readTree(DATA), LocalDate.of(2026, 3, 2));
        assertEquals(3, AlphaBankClient.issued - before);
    }

    @Test
    void afterANewRuleGoesInWithoutChangingTheCalculator() throws Exception {
        Rule extraFee = (unit, posted) ->
            List.of(new Entry("assessment", "Special assessment", 5000));
        var calculator = new ChargeCalculator(
            List.of(new MonthlyDues(EXPENSES), extraFee)
        );
        assertEquals(60625 + 5000, calculator.calculate(units().get(0)).total());
    }

    @Test
    void afterBoardPresidentIsExemptFromDuesAndPaysTheReserve() throws Exception {
        var calculator = new ChargeCalculator(
            List.of(
                new MonthlyDues(EXPENSES),
                new ReserveFund(10),
                new BoardPresidentExemption()
            )
        );
        assertEquals(6790, calculator.calculate(units().get(2)).total());
    }

    @Test
    void afterAUnitInArrearsDoesNotGetTheEarlyPaymentDiscount() throws Exception {
        var calculator = new ChargeCalculator(
            List.of(
                new MonthlyDues(EXPENSES),
                new PastDueBalance(),
                new EarlyPaymentDiscount(5, "2026-03-05")
            )
        );
        assertEquals(3031, calculator.calculate(units().get(0)).discount());
        assertEquals(0, calculator.calculate(units().get(1)).discount());
    }

    @Test
    void afterIssuingWorksWithAnyGatewayWithoutARealBank() throws Exception {
        var gateway = new InMemoryGateway();
        var calculator = new ChargeCalculator(List.of(new MonthlyDues(EXPENSES)));
        var deadlines = new PaymentGateway.Deadlines("2026-03-10", "2026-03-05");
        int before = AlphaBankClient.issued;
        new IssuingService(calculator, gateway, deadlines).issue(units());
        assertEquals(3, gateway.received.size());
        assertEquals(before, AlphaBankClient.issued);
    }
}
