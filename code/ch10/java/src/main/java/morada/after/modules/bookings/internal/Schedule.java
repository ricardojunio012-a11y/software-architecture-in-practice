// Private data of Bookings: one space, one booking per day (simplified).
package morada.after.modules.bookings.internal;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Schedule {

    private final List<String> spaces;
    private final Map<String, String> occupancy = new HashMap<>();

    public Schedule(List<String> spaces) {
        this.spaces = spaces;
    }

    public String occupant(String space, String date) {
        if (!spaces.contains(space)) {
            throw new IllegalArgumentException("space " + space + " does not exist");
        }
        return occupancy.get(space + " " + date);
    }

    public void record(String booking, String space, String date) {
        occupancy.put(space + " " + date, booking);
    }
}
