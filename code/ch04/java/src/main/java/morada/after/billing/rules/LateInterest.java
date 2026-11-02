package morada.after.billing.rules;

import java.time.LocalDate;
import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.shared.Dates;

// Monthly interest, prorated by the days late (30-day month).
public class LateInterest implements Rule {

    private final long monthlyPercent;
    private final LocalDate today;

    public LateInterest(long monthlyPercent, LocalDate today) {
        this.monthlyPercent = monthlyPercent;
        this.today = today;
    }

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        var d = unit.pastDue();
        if (d == null) return List.of();
        long days = Dates.daysBetween(d.dueDate(), today);
        long interest = (d.amountCents() * monthlyPercent * days + 1500) / 3000;
        return List.of(new Entry("interest", "Interest (" + days + " days)", interest));
    }
}
