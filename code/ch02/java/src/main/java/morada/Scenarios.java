// Executable quality scenarios: they generate a synthetic load, measure what is ours,
// estimate what depends on third parties and compare the total with the target.
package morada;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import morada.billing.BillingPeriod;
import morada.billing.Calculation;
import morada.billing.Charge;
import morada.billing.CommunityData;
import morada.billing.EmailToFile;
import morada.billing.Invoice;
import morada.billing.Notice;
import morada.billing.Unit;

public final class Scenarios {

    public record Scenario(
        String id,
        String description,
        int communities,
        int unitsPerCommunity,
        int invoicesPerSecond, // how many invoices the payment processor creates
        long limitSeconds
    ) {}

    public record Result(
        Scenario scenario,
        long charges,
        double calculationSeconds, // measured
        double processorSeconds, // estimated
        long noticeBytes,
        boolean passed
    ) {}

    private Scenarios() {}

    // Synthetic, deterministic community: the same load in every language
    public static CommunityData syntheticCommunity(int i, int units) {
        List<Unit> list = new ArrayList<>();
        for (int k = 1; k <= units; k++) {
            var resident = new Unit.Resident(
                "Resident " + k,
                "resident" + k + "@example.com",
                null,
                "email"
            );
            var pastDue = k % 7 == 0 ? new Unit.PastDue(50000, "2026-02-10") : null;
            list.add(new Unit("U-" + k, 1000000 / units, resident, "invoice", pastDue));
        }
        long expenses = 3000000 + (i % 50) * 10000L;
        var community = new CommunityData.Community(
            "community-" + i,
            "Community " + i,
            expenses
        );
        return new CommunityData(community, list);
    }

    // The scenario's response measure: finish within the limit
    public static boolean evaluate(double seconds, double limitSeconds) {
        return seconds <= limitSeconds;
    }

    public static Result run(Scenario scenario, LocalDate today) {
        Invoice invoice = new Invoice();
        BillingPeriod period = BillingPeriod.of(today);
        long charges = 0;
        long noticeBytes = 0;
        long start = System.nanoTime();
        for (int i = 1; i <= scenario.communities(); i++) {
            CommunityData data = syntheticCommunity(i, scenario.unitsPerCommunity());
            var community = data.community();
            for (Unit unit : data.units()) {
                Charge charge = Calculation.calculateCharge(
                    community.monthlyExpensesCents(),
                    unit,
                    today
                );
                String code = invoice.generateCode(community.id(), period, charge);
                var notice = new Notice(
                    community.name(),
                    period,
                    charge,
                    invoice.name(),
                    code
                );
                noticeBytes += EmailToFile.format(notice)
                    .getBytes(StandardCharsets.UTF_8)
                    .length;
                charges++;
            }
        }
        double calculationSeconds = (System.nanoTime() - start) / 1e9;
        // Creating the invoices depends on the processor: estimated from its capacity
        double processorSeconds = (double) charges / scenario.invoicesPerSecond();
        double total = calculationSeconds + processorSeconds;
        return new Result(
            scenario,
            charges,
            calculationSeconds,
            processorSeconds,
            noticeBytes,
            evaluate(total, scenario.limitSeconds())
        );
    }
}
