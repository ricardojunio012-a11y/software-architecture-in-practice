package morada.after.billing.rules;

import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.shared.Money;

// A percentage of the monthly dues, for the reserve fund.
public class ReserveFund implements Rule {

    private final long percent;

    public ReserveFund(long percent) {
        this.percent = percent;
    }

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        long reserve = Money.percentOf(Entry.amountOf(posted, "dues"), percent);
        return List.of(
            new Entry("reserve", "Reserve fund (" + percent + "%)", reserve)
        );
    }
}
