// Public interface of the charges module: the other modules use only what is here.
package morada.after.charges;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import morada.after.shared.Dates;
import morada.after.shared.Money;

public final class Charges {

    private Charges() {}

    public static List<Charge> calculate(
        long expenses,
        List<Unit> units,
        LocalDate today
    ) {
        return units
            .stream()
            .map(u -> {
                long dues = Money.shareOf(expenses, u.shareMillionths());
                long reserve = Rules.reserveFund(dues);
                var p = u.pastDue();
                long arrears = p == null ? 0 : p.amountCents();
                var l =
                    p == null
                        ? new Rules.LateCharges(0, 0, 0)
                        : Rules.lateCharges(arrears, p.dueDate(), today);
                long total = dues + reserve + arrears + l.lateFee() + l.interest();
                return new Charge(
                    u.id(),
                    u.resident().name(),
                    dues,
                    reserve,
                    arrears,
                    l.days(),
                    l.lateFee(),
                    l.interest(),
                    total
                );
            })
            .toList();
    }

    public static String report(
        String community,
        LocalDate today,
        List<Charge> charges
    ) {
        List<String> lines = new ArrayList<>();
        lines.add("# Charges " + Dates.monthLabel(today) + " - " + community);
        lines.add("unit;resident;dues;reserve;arrears;late_fee;interest;total");
        for (Charge c : charges) {
            var fields = new ArrayList<>(List.of(c.unit(), c.resident()));
            Stream.of(
                c.dues(),
                c.reserve(),
                c.arrears(),
                c.lateFee(),
                c.interest(),
                c.total()
            )
                .map(Money::dollars)
                .forEach(fields::add);
            lines.add(String.join(";", fields));
        }
        return String.join("\n", lines) + "\n";
    }
}
