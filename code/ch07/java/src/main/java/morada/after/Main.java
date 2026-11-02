// Usage: java morada.after.Main <commands.json> <output-folder>
// Assembles the repository and the application service and runs the commands in order.
package morada.after;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.after.application.BookingService;
import morada.after.application.BookingService.Command;
import morada.after.application.InMemorySchedules;
import morada.after.domain.DomainEvent;
import morada.after.domain.DomainEvent.BookingCanceled;
import morada.after.domain.DomainEvent.BookingConfirmed;
import morada.after.domain.Money;
import morada.after.domain.Schedule.UsagePolicy;

public class Main {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Space(String id, long feeCents, int minNoticeDays, int monthlyLimit) {}

    record Data(List<Space> spaces, List<Command> commands) {}

    static String format(DomainEvent e) {
        return switch (e) {
            case BookingConfirmed c -> String.join(
                ";",
                "BookingConfirmed",
                c.booking(),
                c.space(),
                c.slot().toString(),
                c.unit(),
                c.fee().toString()
            );
            case BookingCanceled c -> {
                Money fee = c.cancellationFee();
                String detail =
                    fee.cents() > 0 ? "cancellation fee " + fee : "no cancellation fee";
                yield "BookingCanceled;" + c.booking() + ";" + detail;
            }
        };
    }

    public static void main(String[] args) throws Exception {
        Data data = new ObjectMapper().readValue(Path.of(args[0]).toFile(), Data.class);
        Map<String, UsagePolicy> policies = new LinkedHashMap<>();
        for (Space s : data.spaces()) {
            policies.put(
                s.id(),
                new UsagePolicy(
                    new Money(s.feeCents()),
                    s.minNoticeDays(),
                    s.monthlyLimit()
                )
            );
        }

        List<String> events = new ArrayList<>();
        var schedules = new InMemorySchedules(policies);
        var service = new BookingService(schedules, e -> events.add(format(e)));
        List<String> results = new ArrayList<>();
        for (Command c : data.commands()) {
            var r = service.execute(c);
            results.add(
                String.join(";", r.booking(), r.command(), r.status(), r.detail())
            );
        }
        List<String> schedule = new ArrayList<>();
        for (var s : schedules.all()) {
            for (var b : s.active()) {
                schedule.add(
                    String.join(";", s.space(), b.id(), b.slot().toString(), b.unit())
                );
            }
        }

        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Map<String, List<String>> files = new LinkedHashMap<>();
        files.put("results", results);
        files.put("events", events);
        files.put("schedule", schedule);
        for (var f : files.entrySet()) {
            Files.writeString(
                output.resolve(f.getKey() + ".txt"),
                String.join("\n", f.getValue()) + "\n"
            );
        }
        System.out.println(results.size() + " commands executed; output in " + output);
    }
}
