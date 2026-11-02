// Usage: java morada.Main <input.json> <output-folder> [--today YYYY-MM-DD]
// Assembles the objects and processes the booking requests in the order they arrived.
package morada;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import morada.Approval.MinimumNotice;
import morada.Approval.MonthlyLimit;
import morada.Approval.SpaceAvailable;
import morada.Approval.Stage;
import morada.Approval.UnitInGoodStanding;
import morada.Events.EventBus;
import morada.Notification.ChannelFactory;
import morada.Notification.SimulatedProvider;
import morada.Notification.Wait;
import morada.Subscribers.ChargeUsageFee;
import morada.Subscribers.NotifyFrontDesk;
import morada.Subscribers.NotifyResident;
import morada.Types.BookingRequest;
import morada.Types.Space;
import morada.Types.Unit;

public class Main {

    record InputRequest(String id, String unit, String space, String date) {}

    record Data(
        List<Space> spaces,
        List<Unit> units,
        List<InputRequest> requests,
        Map<String, Integer> simulatedFailures,
        List<String> invalidDestinations,
        List<String> cancellations,
        List<InputRequest> simultaneousRequests
    ) {}

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        Data data = new ObjectMapper().readValue(Path.of(args[0]).toFile(), Data.class);
        Map<String, Space> spaces = data
            .spaces()
            .stream()
            .collect(Collectors.toMap(Space::id, Function.identity()));
        Map<String, Unit> units = data
            .units()
            .stream()
            .collect(Collectors.toMap(Unit::id, Function.identity()));

        Function<Repository.InMemory, Stage> buildApproval = b -> {
            var approval = new UnitInGoodStanding();
            approval
                .andThen(new MinimumNotice(today))
                .andThen(new SpaceAvailable(b))
                .andThen(new MonthlyLimit(b));
            return approval;
        };
        var bookings = new Repository.InMemory();
        var approval = buildApproval.apply(bookings);

        var provider = new SimulatedProvider(
            data.simulatedFailures(),
            data.invalidDestinations()
        );
        List<String> notifications = new ArrayList<>();
        List<String> fees = new ArrayList<>();
        List<String> frontDesk = new ArrayList<>();
        List<String> waits = new ArrayList<>();
        // Simulated clock: records the wait instead of really waiting
        Wait wait = (ms, who) -> waits.add(who + ": wait " + ms + " ms");
        var factory = new ChannelFactory(provider, notifications, wait);
        var events = new EventBus();
        events.subscribe("BookingConfirmed", new ChargeUsageFee(fees));
        events.subscribe("BookingConfirmed", new NotifyFrontDesk(frontDesk));
        events.subscribe("BookingConfirmed", new NotifyResident(factory));
        events.subscribe("BookingRejected", new NotifyResident(factory));

        var service = new BookingService(approval, bookings, events);
        List<String> decisions = new ArrayList<>();
        for (InputRequest r : data.requests()) {
            var request = new BookingRequest(
                r.id(),
                units.get(r.unit()),
                spaces.get(r.space()),
                r.date()
            );
            var d = service.submit(request);
            String result = d.approved() ? "approved" : "rejected;" + d.reason();
            decisions.add(
                String.join(";", r.id(), r.unit(), r.space(), r.date(), result)
            );
        }

        // State: canceling depends on the state the booking is in
        List<String> cancellations = new ArrayList<>();
        for (String id : data.cancellations()) {
            try {
                cancellations.add(id + ";" + service.cancel(id));
            } catch (IllegalStateException error) {
                cancellations.add(id + ";error;" + error.getMessage());
            }
        }

        // Now the hard part: two requests at the same time for the same space and date
        List<BookingRequest> simultaneous = data
            .simultaneousRequests()
            .stream()
            .map(r ->
                new BookingRequest(
                    r.id(),
                    units.get(r.unit()),
                    spaces.get(r.space()),
                    r.date()
                )
            )
            .toList();
        List<String> concurrency = Race.race(simultaneous, () -> {
            var fresh = new Repository.InMemory();
            return new Race.Assembly(buildApproval.apply(fresh), fresh);
        });

        Map<String, List<String>> files = new LinkedHashMap<>();
        files.put("bookings", decisions);
        files.put("notifications", notifications);
        files.put("sent", provider.delivered);
        files.put("fees", fees);
        files.put("front-desk", frontDesk);
        files.put("failures", events.failures);
        files.put("waits", waits);
        files.put("cancellations", cancellations);
        files.put("concurrency", concurrency);
        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        for (var file : files.entrySet()) {
            String text = String.join("\n", file.getValue()) + "\n";
            Files.writeString(output.resolve(file.getKey() + ".txt"), text);
        }
        System.out.println(
            decisions.size() + " requests processed; output in " + output
        );
    }
}
