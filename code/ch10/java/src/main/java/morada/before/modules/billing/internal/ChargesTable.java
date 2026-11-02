// The Billing table: private data of the module. No other module should read it.
package morada.before.modules.billing.internal;

import java.util.ArrayList;
import java.util.List;

public class ChargesTable {

    public static class ChargeRow {

        public final String charge;
        public final String unit;
        public final long amountCents;
        public final String dueDate;
        public String status = "open";
        public int installments = 1;

        public ChargeRow(String charge, String unit, long amountCents, String dueDate) {
            this.charge = charge;
            this.unit = unit;
            this.amountCents = amountCents;
            this.dueDate = dueDate;
        }
    }

    public final List<ChargeRow> rows = new ArrayList<>();

    public ChargeRow find(String charge) {
        return rows
            .stream()
            .filter(r -> r.charge.equals(charge))
            .findFirst()
            .orElseThrow(() ->
                new IllegalArgumentException("charge not found: " + charge)
            );
    }
}
