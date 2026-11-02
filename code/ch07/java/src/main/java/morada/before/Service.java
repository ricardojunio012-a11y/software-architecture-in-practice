// Service that holds every rule. The rules only apply if whoever changes the data
// remembers to go through here; nothing stops other code from changing bookings directly.
package morada.before;

import static morada.before.Model.bookings;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import morada.before.Model.Booking;

public final class Service {

    private Service() {}

    static long days(String from, String to) {
        return ChronoUnit.DAYS.between(LocalDate.parse(from), LocalDate.parse(to));
    }

    static String format(long cents) {
        return String.format(Locale.US, "$%,d.%02d", cents / 100, cents % 100);
    }

    static String hours(int start, int end) {
        return String.format("%02d:00-%02d:00", start, end);
    }

    public static String book(JsonNode c, JsonNode space, List<String> events) {
        String date = c.get("date").asText();
        int start = c.get("start").asInt();
        int end = c.get("end").asInt();
        String sp = c.get("space").asText();
        String unit = c.get("unit").asText();
        if (
            end <= start
        ) return "rejected;invalid time slot: the end must be after the start";
        if (
            days(c.get("requestedOn").asText(), date) <
            space.get("minNoticeDays").asInt()
        ) {
            return "rejected;minimum notice not met";
        }
        for (Booking b : bookings) {
            boolean sameTime = b.date.equals(date) && b.start < end && start < b.end;
            if (b.space.equals(sp) && b.status.equals("confirmed") && sameTime) {
                return "rejected;time slot overlaps " + b.id;
            }
        }
        long thisMonth = bookings
            .stream()
            .filter(b -> b.space.equals(sp) && b.unit.equals(unit))
            .filter(b -> b.status.equals("confirmed"))
            .filter(b -> b.date.substring(0, 7).equals(date.substring(0, 7)))
            .count();
        if (thisMonth >= space.get("monthlyLimit").asInt()) {
            return "rejected;unit's monthly limit reached";
        }

        long fee = space.get("feeCents").asLong();
        DayOfWeek day = LocalDate.parse(date).getDayOfWeek();
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            fee += (fee * 20 + 50) / 100;
        }
        Booking b = new Booking();
        b.id = c.get("booking").asText();
        b.unit = unit;
        b.space = sp;
        b.date = date;
        b.start = start;
        b.end = end;
        b.feeCents = fee;
        bookings.add(b);
        String slot = date + " " + hours(start, end);
        String line = String.join(";", b.id, sp, slot, unit, format(fee));
        events.add("BookingConfirmed;" + line);
        return "confirmed;" + format(fee);
    }

    public static String cancel(JsonNode c, List<String> events) {
        String id = c.get("booking").asText();
        Booking b = bookings
            .stream()
            .filter(x -> x.id.equals(id))
            .findFirst()
            .orElse(null);
        if (b == null) return "not canceled;booking not found";
        if (!b.status.equals("confirmed")) {
            return "not canceled;booking is not confirmed";
        }
        b.status = "canceled";
        boolean late = days(c.get("requestedOn").asText(), b.date) < 2;
        long fee = late ? (b.feeCents * 50 + 50) / 100 : 0;
        String detail =
            fee > 0 ? "cancellation fee " + format(fee) : "no cancellation fee";
        events.add("BookingCanceled;" + b.id + ";" + detail);
        return "canceled;" + detail;
    }
}
