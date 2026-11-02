package morada.after.billing.rules;

import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;
import morada.shared.Dates;
import morada.shared.Money;

// Discount on the dues owed for whoever pays by the agreed day.
// A unit with a past-due balance gets no discount (the chapter 1 rule).
public class EarlyPaymentDiscount implements Rule {

    private final long percent;
    private final String until;

    public EarlyPaymentDiscount(long percent, String until) {
        this.percent = percent;
        this.until = until;
    }

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        long duesOwed =
            Entry.amountOf(posted, "dues") + Entry.amountOf(posted, "exemption");
        if (duesOwed <= 0 || Entry.amountOf(posted, "arrears") > 0) return List.of();
        String description =
            "Discount by " + Dates.monthDay(until) + " (" + percent + "%)";
        long discount = Money.percentOf(duesOwed, percent);
        return List.of(new Entry("discount", description, -discount, true));
    }
}
