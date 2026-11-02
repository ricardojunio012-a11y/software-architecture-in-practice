// Rules for calculating the monthly dues: reads no file and sends nothing.
package morada.billing;

import java.time.LocalDate;

public final class Calculation {

    private static final long RESERVE_FUND = 10; // % of the dues
    // % of the past-due balance (set by the CC&Rs)
    private static final long LATE_FEE = 2;
    // % of the dues, if there is no past-due balance
    private static final long EARLY_PAYMENT_DISCOUNT = 5;

    private Calculation() {}

    // 1% a month, prorated by the days late
    public static long lateInterest(long cents, long days) {
        return (cents * days + 1500) / 3000;
    }

    public static Charge calculateCharge(
        long expensesCents,
        Unit unit,
        LocalDate today
    ) {
        long dues = Money.shareOf(expensesCents, unit.shareMillionths());
        long reserve = Money.percentOf(dues, RESERVE_FUND);
        long arrears = 0;
        long lateFee = 0;
        long interest = 0;
        if (unit.pastDue() != null) {
            arrears = unit.pastDue().amountCents();
            lateFee = Money.percentOf(arrears, LATE_FEE);
            interest = lateInterest(
                arrears,
                BillingPeriod.daysSince(unit.pastDue().dueDate(), today)
            );
        }
        long total = dues + reserve + arrears + lateFee + interest;
        Long totalBy5th =
            arrears == 0 ? total - Money.percentOf(dues, EARLY_PAYMENT_DISCOUNT) : null;
        return new Charge(
            unit,
            dues,
            reserve,
            arrears,
            lateFee,
            interest,
            total,
            totalBy5th
        );
    }
}
