// Internal billing rules. Not "public": the compiler blocks their use outside the package.
package morada.after.charges;

import java.time.LocalDate;
import morada.after.shared.Dates;
import morada.after.shared.Money;

final class Rules {

    private static final long RESERVE_FUND = 10; // % of the dues
    private static final long LATE_FEE = 2; // % of the arrears

    record LateCharges(long days, long lateFee, long interest) {}

    private Rules() {}

    static long reserveFund(long dues) {
        return Money.percentOf(dues, RESERVE_FUND);
    }

    static LateCharges lateCharges(long arrears, String dueDate, LocalDate today) {
        long days = Dates.daysBetween(dueDate, today);
        long interest = (arrears * days + 1500) / 3000; // 1% a month, prorated
        return new LateCharges(days, Money.percentOf(arrears, LATE_FEE), interest);
    }
}
