// Simulates sending email by writing the messages to a file.
package morada.step4;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;

public class EmailToFile implements Notifier {

    private final Path file;

    public EmailToFile(Path file) throws IOException {
        this.file = file;
        Files.writeString(file, "");
    }

    @Override
    public void notify(Notice notice) {
        try {
            Files.writeString(file, format(notice), StandardOpenOption.APPEND);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static String format(Notice notice) {
        Charge c = notice.charge();
        Unit u = c.unit();
        String period = notice.period().label();
        List<String> lines = new ArrayList<>(
            List.of(
                "To: " + u.resident().email(),
                "Subject: Monthly dues " +
                    period +
                    " - " +
                    notice.community() +
                    " - Unit " +
                    u.id(),
                "",
                "Hello, " + u.resident().name() + ".",
                "",
                "The monthly dues for " +
                    period +
                    " for unit " +
                    u.id() +
                    " are now available.",
                "Amount: $" + Money.dollars(c.total()),
                "Due date: " + notice.period().dueDate()
            )
        );
        if (c.totalBy5th() != null) {
            lines.add(
                "Pay by " +
                    notice.period().discountDeadline() +
                    " and the amount drops to $" +
                    Money.dollars(c.totalBy5th()) +
                    "."
            );
        }
        if (c.arrears() > 0) {
            lines.add(
                "Includes a past-due balance of $" +
                    Money.dollars(c.arrears()) +
                    ", with a late fee of $" +
                    Money.dollars(c.lateFee()) +
                    " and interest of $" +
                    Money.dollars(c.interest()) +
                    "."
            );
        }
        lines.addAll(
            List.of(
                notice.paymentName() + ": " + notice.paymentCode(),
                "",
                notice.community() + " Management",
                "----"
            )
        );
        return String.join("\n", lines) + "\n";
    }
}
