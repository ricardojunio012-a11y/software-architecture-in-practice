// Unit tests for step 3: possible because the calculation was separated from the rest.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import morada.step3.Application;
import morada.step3.Calculation;
import morada.step3.Charge;
import morada.step3.CommunityData;
import morada.step3.Invoice;
import morada.step3.Notice;
import morada.step3.Unit;
import org.junit.jupiter.api.Test;

class Step3Test {

    static final LocalDate TODAY = LocalDate.of(2026, 3, 2);

    static Unit unit(String id, long share, Unit.PastDue arrears) {
        return new Unit(
            id,
            share,
            new Unit.Resident("Anna", "anna@example.com", null, "email"),
            "invoice",
            arrears
        );
    }

    @Test
    void splitsExpensesByShareAndAddsReserveFund() {
        Charge c = Calculation.calculateCharge(
            485000,
            unit("A-101", 125000, null),
            TODAY
        );
        assertEquals(60625, c.dues());
        assertEquals(6063, c.reserve());
        assertEquals(66688, c.total());
    }

    @Test
    void chargesLateFeeAndInterestProratedByDaysLate() {
        Unit u = unit("A-101", 125000, new Unit.PastDue(66750, "2026-02-10"));
        Charge c = Calculation.calculateCharge(485000, u, TODAY);
        assertEquals(1335, c.lateFee());
        assertEquals(445, c.interest()); // 20 days
        assertEquals(66688 + 66750 + 1335 + 445, c.total());
    }

    @Test
    void notifiesEachResidentOnceWithoutSendingAnything() {
        List<Notice> notices = new ArrayList<>();
        CommunityData data = new CommunityData(
            new CommunityData.Community("test", "Test Community", 100000),
            List.of(unit("A-101", 500000, null), unit("A-102", 500000, null))
        );
        Application.generateBilling(data, TODAY, new Invoice(), notices::add);
        assertEquals(
            List.of("A-101", "A-102"),
            notices
                .stream()
                .map(a -> a.charge().unit().id())
                .toList()
        );
        assertEquals("INV-test-202603-A-101-55000", notices.get(0).paymentCode());
    }
}
