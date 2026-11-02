// The month's charge report, for the management company.
package morada.step3;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public class ChargeReport {

    private final List<String> lines = new ArrayList<>();

    public ChargeReport(String community, BillingPeriod period) {
        lines.add(
            "# Charges " +
                period.label() +
                " - " +
                community +
                " - due " +
                period.dueDate()
        );
        lines.add("unit;resident;dues;reserve;arrears;late_fee;interest;total;payment");
    }

    public void add(Charge c, String paymentCode) {
        Stream<String> values = Stream.of(
            c.dues(),
            c.reserve(),
            c.arrears(),
            c.lateFee(),
            c.interest(),
            c.total()
        ).map(Money::dollars);
        List<String> fields = new ArrayList<>(
            List.of(c.unit().id(), c.unit().resident().name())
        );
        values.forEach(fields::add);
        fields.add(paymentCode);
        lines.add(String.join(";", fields));
    }

    public void save(Path file) throws IOException {
        Files.writeString(file, String.join("\n", lines) + "\n");
    }
}
