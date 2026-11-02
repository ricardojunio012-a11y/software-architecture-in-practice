// Usage: java morada.after.Main <input.json> <output-folder> [--today YYYY-MM-DD]
// Composition root: the only place that knows the concrete classes and assembles them.
package morada.after;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import morada.after.billing.ChargeCalculator;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.after.billing.rules.*;
import morada.after.issuing.IssuingService;
import morada.after.issuing.PaymentGateway;
import morada.after.issuing.PaymentGateway.Deadlines;
import morada.after.providers.AlphaBankGateway;
import morada.after.providers.EasyPayGateway;
import morada.external.AlphaBankClient;
import morada.external.EasyPayApi;
import morada.shared.Dates;

public class Main {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Community(String name, long monthlyExpensesCents) {}

    record Policy(
        int reserveFundPercent,
        int lateFeePercent,
        int monthlyInterestPercent,
        int earlyDiscountPercent,
        int discountByDay,
        int dueDay
    ) {}

    record Data(Community community, List<Unit> units, Policy policy) {}

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        Data data = new ObjectMapper().readValue(Path.of(args[0]).toFile(), Data.class);
        Policy p = data.policy();
        var deadlines = new Deadlines(
            Dates.dateInMonth(today, p.dueDay()),
            Dates.dateInMonth(today, p.discountByDay())
        );

        // Order matters: each rule sees what the previous ones posted
        List<Rule> rules = List.of(
            new MonthlyDues(data.community().monthlyExpensesCents()),
            new ReserveFund(p.reserveFundPercent()),
            new BoardPresidentExemption(),
            new PastDueBalance(),
            new LateFee(p.lateFeePercent()),
            new LateInterest(p.monthlyInterestPercent(), today),
            // Last: the discount depends on the exemption and the past-due balance
            new EarlyPaymentDiscount(
                p.earlyDiscountPercent(),
                deadlines.discountUntil()
            )
        );
        Map<String, Supplier<PaymentGateway>> gateways = Map.of(
            "alpha",
            () -> new AlphaBankGateway(new AlphaBankClient()),
            "easypay",
            () -> new EasyPayGateway(new EasyPayApi())
        );
        String chosen = System.getenv().getOrDefault("GATEWAY", "alpha");
        PaymentGateway gateway = gateways.get(chosen).get();
        var service = new IssuingService(
            new ChargeCalculator(rules),
            gateway,
            deadlines
        );

        var result = service.issue(data.units());
        String title = Dates.monthLabel(today) + " - " + data.community().name();
        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("charges.txt"),
            Reports.charges(title, result.charges(), deadlines)
        );
        Files.writeString(
            output.resolve("registrations.txt"),
            Reports.registrations(
                title,
                gateway.name(),
                result.charges(),
                result.registrations()
            )
        );
        System.out.println("charges issued in " + output + " (" + gateway.name() + ")");
    }
}
