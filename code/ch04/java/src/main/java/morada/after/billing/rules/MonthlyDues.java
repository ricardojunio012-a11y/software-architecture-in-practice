package morada.after.billing.rules;

import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.shared.Money;

// The unit's part of the month's expenses, by its ownership share.
public class MonthlyDues implements Rule {

    private final long monthlyExpenses;

    public MonthlyDues(long monthlyExpenses) {
        this.monthlyExpenses = monthlyExpenses;
    }

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        long dues = Money.shareOf(monthlyExpenses, unit.shareMillionths());
        return List.of(new Entry("dues", "Monthly dues", dues));
    }
}
