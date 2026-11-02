// Value object: a period of use within one day. The end never comes before the start.
package morada.after.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record TimeSlot(String date, int start, int end) {
    public TimeSlot {
        if (end <= start) {
            throw new DomainError("invalid time slot: the end must be after the start");
        }
    }

    public boolean overlaps(TimeSlot other) {
        return date.equals(other.date) && start < other.end && other.start < end;
    }

    public String month() {
        return date.substring(0, 7);
    }

    public long daysSince(String day) {
        return ChronoUnit.DAYS.between(LocalDate.parse(day), LocalDate.parse(date));
    }

    public boolean isWeekend() {
        DayOfWeek day = LocalDate.parse(date).getDayOfWeek();
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
    }

    // 2026-03-14 14:00-22:00
    @Override
    public String toString() {
        return String.format("%s %02d:00-%02d:00", date, start, end);
    }
}
