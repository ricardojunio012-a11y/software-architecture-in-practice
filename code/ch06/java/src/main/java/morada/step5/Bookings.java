// Bookings module. Step 5: separate phases (Split Phase) and no global state.
// decide() calculates; report() and notices() format; main reads and writes.
package morada.step5;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

public final class Bookings {

    private Bookings() {}

    static final int MIN_NOTICE_DAYS = 2;
    static final int SATURDAY_SURCHARGE_PERCENT = 20;
    static final int GUEST_LIMIT = 50;
    static final long EXTRA_CLEANING_FEE = 5000; // cents

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Space(String id, long fee) {}

    public record Unit(String id, String email, boolean inArrears) {}

    public record Request(
        String id,
        String unit,
        String space,
        String date,
        int guests
    ) {}

    public record Data(List<Space> spaces, List<Unit> units, List<Request> requests) {}

    public record Decision(Request request, String email, String reason, long amount) {}

    public record Notice(String to, String text) {}

    static long daysUntil(String isoDate, LocalDate today) {
        return ChronoUnit.DAYS.between(today, LocalDate.parse(isoDate));
    }

    // The original comment said "weekend", but the code only checks Saturday
    static boolean isSaturday(String isoDate) {
        return LocalDate.parse(isoDate).getDayOfWeek() == DayOfWeek.SATURDAY;
    }

    public static long bookingAmount(Space space, Request request) {
        long amount = space.fee();
        if (isSaturday(request.date())) amount +=
            (amount * SATURDAY_SURCHARGE_PERCENT) / 100;
        if (request.guests() > GUEST_LIMIT) amount += EXTRA_CLEANING_FEE;
        return amount;
    }

    public static String declineReason(
        Request request,
        Unit unit,
        LocalDate today,
        List<Request> approved
    ) {
        if (unit.inArrears()) return "arrears";
        if (daysUntil(request.date(), today) < MIN_NOTICE_DAYS) return "short notice";
        boolean taken = approved
            .stream()
            .anyMatch(
                b ->
                    b.space().equals(request.space()) && b.date().equals(request.date())
            );
        return taken ? "conflict" : null;
    }

    // Phase 1: decide each request, in order. The approved list is now local.
    public static List<Decision> decide(Data data, LocalDate today) {
        List<Request> approved = new ArrayList<>();
        List<Decision> decisions = new ArrayList<>();
        for (Request request : data.requests()) {
            Unit unit = data
                .units()
                .stream()
                .filter(u -> u.id().equals(request.unit()))
                .findFirst()
                .orElseThrow();
            Space space = data
                .spaces()
                .stream()
                .filter(s -> s.id().equals(request.space()))
                .findFirst()
                .orElseThrow();
            String reason = declineReason(request, unit, today, approved);
            long amount = 0;
            if (reason == null) {
                approved.add(request);
                amount = bookingAmount(space, request);
            }
            decisions.add(new Decision(request, unit.email(), reason, amount));
        }
        return decisions;
    }

    static String dollars(long cents) {
        return cents / 100 + "." + String.format("%02d", cents % 100);
    }

    // Phase 2: format the report and the notices from the decisions
    public static List<String> report(List<Decision> decisions) {
        return decisions
            .stream()
            .map(d -> {
                Request r = d.request();
                String head = String.join(";", r.id(), r.unit(), r.space(), r.date());
                return d.reason() != null
                    ? head + ";declined;" + d.reason()
                    : head + ";approved;" + dollars(d.amount());
            })
            .toList();
    }

    public static List<Notice> notices(List<Decision> decisions) {
        return decisions
            .stream()
            .map(d -> {
                String id = d.request().id();
                String confirmed = "Booking " + id + " confirmed. Amount: $";
                return new Notice(
                    d.email(),
                    d.reason() != null
                        ? "Booking " + id + " declined (" + d.reason() + ")"
                        : confirmed + dollars(d.amount())
                );
            })
            .toList();
    }
}
