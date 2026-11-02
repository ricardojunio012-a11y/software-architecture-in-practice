package morada.after.billing.rules;

import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.shared.Dates;

// The amount left unpaid from the previous month.
public class PastDueBalance implements Rule {

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        var d = unit.pastDue();
        if (d == null) return List.of();
        String description =
            "Past-due balance (due " + Dates.monthDay(d.dueDate()) + ")";
        return List.of(new Entry("arrears", description, d.amountCents()));
    }
}
