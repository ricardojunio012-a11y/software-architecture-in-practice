// Open for extension, closed for modification: a new rule is a new class, handed in
// through the constructor. This class does not change.
package morada.after.billing;

import java.util.ArrayList;
import java.util.List;

public class ChargeCalculator {

    private final List<Rule> rules;

    public ChargeCalculator(List<Rule> rules) {
        this.rules = List.copyOf(rules);
    }

    public Charge calculate(Unit unit) {
        List<Entry> posted = new ArrayList<>();
        for (Rule rule : rules) {
            posted.addAll(rule.apply(unit, List.copyOf(posted)));
        }
        return new Charge(unit.id(), unit.resident().name(), posted);
    }
}
