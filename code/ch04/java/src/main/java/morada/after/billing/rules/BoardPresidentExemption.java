package morada.after.billing.rules;

import java.util.List;
import morada.after.billing.Entry;
import morada.after.billing.Rule;
import morada.after.billing.Unit;

// The board president does not pay the monthly dues (the reserve fund still applies).
public class BoardPresidentExemption implements Rule {

    @Override
    public List<Entry> apply(Unit unit, List<Entry> posted) {
        if (!unit.boardPresident()) return List.of();
        long dues = Entry.amountOf(posted, "dues");
        return List.of(new Entry("exemption", "Board president exemption", -dues));
    }
}
