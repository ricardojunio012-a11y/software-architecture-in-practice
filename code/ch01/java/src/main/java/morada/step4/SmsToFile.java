// New notification channel: added without touching the email.
// Simulates sending by writing the messages to a file.
package morada.step4;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

public class SmsToFile implements Notifier {

    private final Path file;

    public SmsToFile(Path file) throws IOException {
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
        StringBuilder text = new StringBuilder(
            notice.community() +
                ": dues " +
                notice.period().label() +
                " for unit " +
                u.id() +
                ": $" +
                Money.dollars(c.total()) +
                ", due " +
                notice.period().dueDate() +
                "."
        );
        if (c.totalBy5th() != null) {
            text.append(" By ")
                .append(notice.period().discountDeadline())
                .append(": $")
                .append(Money.dollars(c.totalBy5th()))
                .append(".");
        }
        text.append(" ")
            .append(notice.paymentName())
            .append(": ")
            .append(notice.paymentCode());
        return "To: " + u.resident().phone() + "\n" + text + "\n----\n";
    }
}
