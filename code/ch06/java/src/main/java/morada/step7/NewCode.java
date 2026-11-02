// The new code: the refactored module from step 5 plus the limit rule, which was
// already born separate in step 6 (the sprout class) and so migrates without a rewrite.
package morada.step7;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import morada.step5.Bookings;
import morada.step5.Bookings.Decision;
import morada.step5.Bookings.Request;
import morada.step6.MonthlyLimit;

public final class NewCode {

    private NewCode() {}

    public static List<Decision> decide(Bookings.Data data, LocalDate today) {
        MonthlyLimit limit = new MonthlyLimit();
        List<Request> approved = new ArrayList<>();
        List<Decision> decisions = new ArrayList<>();
        for (Request request : data.requests()) {
            var unit = data
                .units()
                .stream()
                .filter(u -> u.id().equals(request.unit()))
                .findFirst()
                .orElseThrow();
            var space = data
                .spaces()
                .stream()
                .filter(s -> s.id().equals(request.space()))
                .findFirst()
                .orElseThrow();
            String reason = Bookings.declineReason(request, unit, today, approved);
            if (
                reason == null && limit.reached(booking(request), ofMonth(approved))
            ) reason = "monthly booking limit reached";
            long amount = 0;
            if (reason == null) {
                approved.add(request);
                amount = Bookings.bookingAmount(space, request);
            }
            decisions.add(new Decision(request, unit.email(), reason, amount));
        }
        return decisions;
    }

    static MonthlyLimit.Booking booking(Request r) {
        return new MonthlyLimit.Booking(r.unit(), r.space(), r.date());
    }

    static List<MonthlyLimit.Booking> ofMonth(List<Request> approved) {
        return approved.stream().map(NewCode::booking).toList();
    }
}
