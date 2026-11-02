// Each rule looks at the unit and at what was already posted, and returns what it adds.
package morada.after.billing;

import java.util.List;

public interface Rule {
    List<Entry> apply(Unit unit, List<Entry> posted);
}
