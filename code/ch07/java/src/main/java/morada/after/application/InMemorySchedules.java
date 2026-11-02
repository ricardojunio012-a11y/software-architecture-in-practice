// Repository: one per aggregate. It saves the whole schedule, never a single booking.
// In memory in the lab; chapter 16 keeps the schedules in a database.
package morada.after.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.after.domain.DomainError;
import morada.after.domain.Schedule;
import morada.after.domain.Schedule.UsagePolicy;

public class InMemorySchedules {

    private final Map<String, Schedule> schedules = new LinkedHashMap<>();

    public InMemorySchedules(Map<String, UsagePolicy> policies) {
        policies.forEach((space, policy) ->
            schedules.put(space, new Schedule(space, policy))
        );
    }

    public Schedule forSpace(String space) {
        Schedule schedule = schedules.get(space);
        if (schedule == null) throw new DomainError("unknown space: " + space);
        return schedule;
    }

    public Schedule forBooking(String booking) {
        return schedules
            .values()
            .stream()
            .filter(s -> s.has(booking))
            .findFirst()
            .orElseThrow(() -> new DomainError("booking not found"));
    }

    public void save(Schedule schedule) {
        schedules.put(schedule.space(), schedule);
    }

    public List<Schedule> all() {
        return List.copyOf(schedules.values());
    }
}
