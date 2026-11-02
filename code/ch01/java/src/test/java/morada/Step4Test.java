// Unit tests for the three changes, made on the refactored code.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import morada.step4.Application;
import morada.step4.Calculation;
import morada.step4.Card;
import morada.step4.CommunityData;
import morada.step4.Invoice;
import morada.step4.Notifier;
import morada.step4.Unit;
import org.junit.jupiter.api.Test;

class Step4Test {

    static final LocalDate TODAY = LocalDate.of(2026, 3, 2);
    static final Unit.Resident ANNA = new Unit.Resident(
        "Anna",
        "anna@example.com",
        null,
        "email"
    );

    @Test
    void givesEarlyPaymentDiscountWithoutPastDueBalance() {
        Unit u = new Unit("A-101", 125000, ANNA, "invoice", null);
        assertEquals(
            66688 - 3031,
            Calculation.calculateCharge(485000, u, TODAY).totalBy5th()
        );
    }

    @Test
    void givesNoDiscountWithPastDueBalance() {
        Unit u = new Unit(
            "A-101",
            125000,
            ANNA,
            "invoice",
            new Unit.PastDue(1000, "2026-02-10")
        );
        assertNull(Calculation.calculateCharge(485000, u, TODAY).totalBy5th());
    }

    @Test
    void usesCardAndSmsWhenTheUnitAsks() {
        List<String> email = new ArrayList<>();
        List<String> sms = new ArrayList<>();
        Notifier byEmail = notice -> email.add(notice.paymentCode());
        Notifier bySms = notice -> sms.add(notice.paymentCode());
        Unit.Resident beth = new Unit.Resident(
            "Beth",
            "beth@example.com",
            "+1 555-0100",
            "sms"
        );
        CommunityData data = new CommunityData(
            new CommunityData.Community("test", "Test Community", 100000),
            List.of(
                new Unit("A-101", 500000, ANNA, "invoice", null),
                new Unit("A-102", 500000, beth, "card", null)
            )
        );
        Application.generateBilling(
            data,
            TODAY,
            Map.of("invoice", new Invoice(), "card", new Card()),
            Map.of("email", byEmail, "sms", bySms)
        );
        assertEquals(List.of("INV-test-202603-A-101-55000"), email);
        assertEquals(List.of("CARD-test-202603-A-102-55000"), sms);
    }
}
