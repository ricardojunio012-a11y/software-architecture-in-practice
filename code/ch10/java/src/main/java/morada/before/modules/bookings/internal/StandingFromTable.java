// Before: the shortcut. Bookings reads the Billing table directly and reimplements
// the delinquency rule on its own, unaware that an installment agreement keeps the
// unit in good standing.
package morada.before.modules.bookings.internal;

import morada.before.modules.billing.internal.ChargesTable;
import morada.before.modules.bookings.Bookings.FinancialStanding;

public class StandingFromTable implements FinancialStanding {

    private final ChargesTable table;

    public StandingFromTable(ChargesTable table) {
        this.table = table;
    }

    public boolean unitInGoodStanding(String unit, String today) {
        return table.rows
            .stream()
            .noneMatch(
                r ->
                    r.unit.equals(unit) &&
                    !r.status.equals("paid") &&
                    r.dueDate.compareTo(today) < 0
            );
    }
}
