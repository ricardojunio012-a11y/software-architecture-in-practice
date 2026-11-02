// Anemic model: only data, all public and writable. No rule lives here.
package morada.before;

import java.util.ArrayList;
import java.util.List;

public final class Model {

    private Model() {}

    public static class Booking {

        public String id = "";
        public String unit = "";
        public String space = "";
        public String date = "";
        public int start;
        public int end;
        public String status = "confirmed";
        public long feeCents;
    }

    // The data of every booking, which any part of the system can read and change
    public static final List<Booking> bookings = new ArrayList<>();
}
