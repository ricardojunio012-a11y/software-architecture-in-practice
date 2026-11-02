// The Backend for Frontend of the front-desk staff app. It belongs to the app team and
// speaks the language of the screen: it gathers in one call what the tablet needs and
// receives the operations made offline, in a batch, applying each one only once.
package morada;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import morada.Backend.Bookings;
import morada.Backend.FrontDesk;
import morada.Backend.Guest;

public class StaffBff {

    public record Operation(
        String id,
        String type,
        String time,
        String packageId,
        Integer seenVersion,
        String name,
        String booking
    ) {}

    public record PendingPackage(String id, String unit, int version) {}

    public record HomeScreen(
        List<PendingPackage> pendingPackages,
        List<Guest> expectedVisitors
    ) {}

    public record Result(Operation operation, String result) {}

    private final FrontDesk frontDesk;
    private final Bookings bookings;
    private final Map<String, String> results;
    public int repeated = 0;

    // Without the third argument, the results live only in this process's memory
    public StaffBff(FrontDesk frontDesk, Bookings bookings) {
        this(frontDesk, bookings, new HashMap<>());
    }

    public StaffBff(
        FrontDesk frontDesk,
        Bookings bookings,
        Map<String, String> results
    ) {
        this.frontDesk = frontDesk;
        this.bookings = bookings;
        this.results = results;
    }

    // The whole home screen in one call, with only the fields the tablet shows
    public HomeScreen home() {
        var pending = frontDesk.packages
            .values()
            .stream()
            .filter(p -> p.status.equals("at front desk"))
            .map(p -> new PendingPackage(p.id, p.unit, p.version))
            .toList();
        // Compares name and booking field by field: "Anna" must not match "Mary Anna"
        var expected = bookings
            .guests()
            .stream()
            .filter(g ->
                frontDesk.visitors
                    .stream()
                    .noneMatch(
                        v ->
                            v.name().equals(g.name()) && v.booking().equals(g.booking())
                    )
            )
            .toList();
        return new HomeScreen(pending, expected);
    }

    // Idempotent by operation id: a resent batch applies nothing twice
    public List<Result> sync(String tablet, List<Operation> operations) {
        List<Result> output = new ArrayList<>();
        for (Operation op : operations) {
            String previous = results.get(op.id());
            if (previous != null) {
                repeated++;
                output.add(new Result(op, previous));
                continue;
            }
            String result = op.type().equals("registerVisitor")
                ? frontDesk.registerVisitor(op.name(), op.booking(), tablet, op.time())
                : frontDesk.change(
                      op.packageId(),
                      op.type().equals("deliver") ? "delivered" : "returned",
                      op.seenVersion(),
                      tablet,
                      op.time()
                  );
            results.put(op.id(), result);
            output.add(new Result(op, result));
        }
        return output;
    }
}
