// Usage: java morada.after.Main <input.json> <output-folder> [--today YYYY-MM-DD]
// Wires the modules together; the order of the reports no longer matters.
package morada.after;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.after.charges.Charge;
import morada.after.charges.Charges;
import morada.after.charges.Unit;
import morada.after.delinquency.Delinquency;
import morada.after.financialreport.FinancialReport;

public class Main {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Community(String name, long monthlyExpensesCents) {}

    record Data(
        Community community,
        List<Unit> units,
        List<FinancialReport.Expense> expenses,
        long reserveFundOpeningBalanceCents
    ) {}

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        Data data = new ObjectMapper().readValue(Path.of(args[0]).toFile(), Data.class);
        String name = data.community().name();
        List<Charge> charges = Charges.calculate(
            data.community().monthlyExpensesCents(),
            data.units(),
            today
        );

        Map<String, String> reports = new LinkedHashMap<>();
        reports.put("delinquency", Delinquency.report(name, today, charges));
        reports.put("charges", Charges.report(name, today, charges));
        reports.put(
            "financial-report",
            FinancialReport.generate(
                name,
                today,
                charges,
                data.expenses(),
                data.reserveFundOpeningBalanceCents()
            )
        );
        Path output = Files.createDirectories(Path.of(args[1]));
        for (var r : reports.entrySet()) {
            Files.writeString(output.resolve(r.getKey() + ".txt"), r.getValue());
        }
        System.out.println("reports generated in " + args[1]);
    }
}
