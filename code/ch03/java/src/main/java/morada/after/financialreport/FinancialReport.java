// Financial report to owners: receives only what it needs, as parameters.
package morada.after.financialreport;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import morada.after.charges.Charge;
import morada.after.shared.Dates;
import morada.after.shared.Money;

public final class FinancialReport {

    public record Expense(String category, long amountCents) {}

    private FinancialReport() {}

    public static String generate(
        String community,
        LocalDate today,
        List<Charge> charges,
        List<Expense> expenses,
        long reserveOpeningBalance
    ) {
        long dues = charges.stream().mapToLong(Charge::dues).sum();
        long reserve = charges.stream().mapToLong(Charge::reserve).sum();
        List<String> lines = new ArrayList<>();
        lines.add("# Financial report " + Dates.monthLabel(today) + " - " + community);
        lines.add("income;monthly dues;" + Money.dollars(dues));
        lines.add("income;reserve fund;" + Money.dollars(reserve));
        for (Expense e : expenses) {
            String amount = Money.dollars(e.amountCents());
            lines.add("expenses;" + e.category() + ";" + amount);
        }
        long totalExpenses = expenses.stream().mapToLong(Expense::amountCents).sum();
        lines.add("expenses;total;" + Money.dollars(totalExpenses));
        lines.add("reserve;opening balance;" + Money.dollars(reserveOpeningBalance));
        String projected = Money.dollars(reserveOpeningBalance + reserve);
        lines.add("reserve;projected balance;" + projected);
        return String.join("\n", lines) + "\n";
    }
}
