// Outbound port: what the system needs to keep the schedules.
package morada.application;

import java.util.List;
import morada.domain.Schedule;

public interface ScheduleRepository {
    List<Schedule> all();

    Schedule forSpace(String space);

    Schedule forBooking(String booking);

    void save(Schedule schedule);
}
