// After: Bookings asks Billing through the public API. The delinquency rule stays
// in one place, the module that owns it.
package morada.after.modules.bookings.internal;

import morada.after.modules.billing.Billing;
import morada.after.modules.bookings.Bookings.FinancialStanding;

public class StandingFromBilling implements FinancialStanding {

    private final Billing billing;

    public StandingFromBilling(Billing billing) {
        this.billing = billing;
    }

    public boolean unitInGoodStanding(String unit, String today) {
        return billing.unitInGoodStanding(unit, today);
    }
}
