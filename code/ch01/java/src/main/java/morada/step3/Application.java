// Orchestrates the monthly run: calculates, creates the payment, records and notifies.
package morada.step3;

import java.time.LocalDate;

public final class Application {

    private Application() {}

    public static ChargeReport generateBilling(
        CommunityData data,
        LocalDate today,
        PaymentMethod payment,
        Notifier notifier
    ) {
        CommunityData.Community community = data.community();
        BillingPeriod period = BillingPeriod.of(today);
        ChargeReport report = new ChargeReport(community.name(), period);
        for (Unit unit : data.units()) {
            Charge charge = Calculation.calculateCharge(
                community.monthlyExpensesCents(),
                unit,
                today
            );
            String code = payment.generateCode(community.id(), period, charge);
            report.add(charge, code);
            notifier.notify(
                new Notice(community.name(), period, charge, payment.name(), code)
            );
        }
        return report;
    }
}
