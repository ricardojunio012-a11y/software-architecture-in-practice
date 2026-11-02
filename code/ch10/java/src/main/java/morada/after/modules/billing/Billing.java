// Public API of Billing: the only door the other modules may use.
package morada.after.modules.billing;

import java.util.Locale;
import morada.after.modules.billing.internal.ChargesTable;
import morada.after.modules.billing.internal.ChargesTable.ChargeRow;

public class Billing {

    private final ChargesTable table;

    public Billing(ChargesTable table) {
        this.table = table;
    }

    public static String dollars(long cents) {
        return String.format(Locale.US, "$%,d.%02d", cents / 100, cents % 100);
    }

    public String issue(String charge, String unit, long amountCents, String dueDate) {
        table.rows.add(new ChargeRow(charge, unit, amountCents, dueDate));
        return unit + " " + dollars(amountCents) + " due " + dueDate;
    }

    public String pay(String charge, String on) {
        table.find(charge).status = "paid";
        return "on " + on;
    }

    public String split(String charge, int installments) {
        var row = table.find(charge);
        row.status = "split";
        row.installments = installments;
        return installments + " installments";
    }

    // Delinquency rule: a charge split into installments under an agreement is not debt
    public boolean unitInGoodStanding(String unit, String today) {
        return table.rows
            .stream()
            .noneMatch(
                r ->
                    r.unit.equals(unit) &&
                    r.status.equals("open") &&
                    r.dueDate.compareTo(today) < 0
            );
    }
}
