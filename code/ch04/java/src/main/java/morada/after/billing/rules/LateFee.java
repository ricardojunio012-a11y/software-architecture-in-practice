package morada.after.billing.rules;

import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.shared.Money;

// A one-time late fee on the past-due balance.
public class LateFee implements Rule {

    private final long percent;

    public LateFee(long percent) {
        this.percent = percent;
    }

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        var d = unit.pastDue();
        if (d == null) return List.of();
        long fee = Money.percentOf(d.amountCents(), percent);
        return List.of(new Entry("late-fee", "Late fee (" + percent + "%)", fee));
    }
}
