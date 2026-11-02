// Orchestrates the monthly run: calculates, creates the payment, records and notifies.
package morada.step4;

import java.time.LocalDate;
import java.util.Map;

public final class Application {

    private Application() {}

    public static ChargeReport generateBilling(
        CommunityData data,
        LocalDate today,
        Map<String, PaymentMethod> paymentMethods,
        Map<String, Notifier> notifiers
    ) {
        CommunityData.Community community = data.community();
        BillingPeriod period = BillingPeriod.of(today);
        ChargeReport report = new ChargeReport(community.name(), period);
        for (Unit unit : data.units()) {
            PaymentMethod payment = paymentMethods.get(unit.paymentMethod());
            Notifier notifier = notifiers.get(unit.resident().channel());
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
