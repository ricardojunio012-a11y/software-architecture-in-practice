// Data layer: where the schedules are stored. Today, in memory; in chapter 16,
// in a database. The layers above do not notice the change.
package morada.layers.data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.layers.domain.Errors.NotFoundError;
import morada.layers.domain.Schedule;
import morada.layers.domain.Schedule.Space;

public class ScheduleRepository {

    private final Map<String, Schedule> schedules = new LinkedHashMap<>();

    public ScheduleRepository(List<Space> spaces) {
        for (Space s : spaces) schedules.put(s.id(), new Schedule(s));
    }

    public List<Schedule> all() {
        return List.copyOf(schedules.values());
    }

    public Schedule forSpace(String id) {
        Schedule schedule = schedules.get(id);
        if (schedule == null) throw new NotFoundError("space not found");
        return schedule;
    }

    public Schedule forBooking(String id) {
        return schedules
            .values()
            .stream()
            .filter(s -> s.has(id))
            .findFirst()
            .orElseThrow(() -> new NotFoundError("booking not found"));
    }
}
