// In-memory outbound adapter: fast and dependency-free, good for tests.
// Everything is gone when the process ends.
package morada.adapters.outbound;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.application.ScheduleRepository;
import morada.domain.Errors.NotFoundError;
import morada.domain.Schedule;
import morada.domain.Schedule.Space;

public class InMemorySchedules implements ScheduleRepository {

    private final Map<String, Schedule> schedules = new LinkedHashMap<>();

    public InMemorySchedules(List<Space> spaces) {
        for (Space s : spaces) schedules.put(s.id(), new Schedule(s));
    }

    public List<Schedule> all() {
        return List.copyOf(schedules.values());
    }

    public Schedule forSpace(String space) {
        Schedule schedule = schedules.get(space);
        if (schedule == null) throw new NotFoundError("space not found");
        return schedule;
    }

    public Schedule forBooking(String booking) {
        return schedules
            .values()
            .stream()
            .filter(s ->
                s
                    .bookings()
                    .stream()
                    .anyMatch(b -> b.id().equals(booking))
            )
            .findFirst()
            .orElseThrow(() -> new NotFoundError("booking not found"));
    }

    // The in-memory schedule is the changed object itself: there is nothing to write
    public void save(Schedule schedule) {}
}
