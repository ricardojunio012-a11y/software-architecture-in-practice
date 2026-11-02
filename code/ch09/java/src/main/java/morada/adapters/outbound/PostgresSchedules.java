// PostgreSQL outbound adapter: it fulfills the same port, keeping the bookings in a
// table. It is the only file that knows SQL and the database driver (JDBC).
package morada.adapters.outbound;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.application.ScheduleRepository;
import morada.domain.Errors.NotFoundError;
import morada.domain.Schedule;
import morada.domain.Schedule.Booking;
import morada.domain.Schedule.Space;

public class PostgresSchedules implements ScheduleRepository {

    private final Connection db;
    private final Map<String, Space> spaces = new LinkedHashMap<>();

    public PostgresSchedules(Connection db, List<Space> spaces) {
        this.db = db;
        for (Space s : spaces) this.spaces.put(s.id(), s);
    }

    // Drops and recreates the table: the lab always starts from scratch
    public void prepare() throws SQLException {
        try (var sql = db.createStatement()) {
            sql.execute("DROP TABLE IF EXISTS bookings");
            sql.execute(
                """
                CREATE TABLE bookings (
                    id text PRIMARY KEY,
                    space text NOT NULL,
                    unit text NOT NULL,
                    date text NOT NULL,
                    start_hour integer NOT NULL,
                    end_hour integer NOT NULL,
                    fee_cents integer NOT NULL
                )"""
            );
        }
    }

    public List<Schedule> all() {
        return spaces.keySet().stream().map(this::forSpace).toList();
    }

    public Schedule forSpace(String space) {
        Space s = spaces.get(space);
        if (s == null) throw new NotFoundError("space not found");
        String sql = """
        SELECT id, unit, date, start_hour, end_hour, fee_cents FROM bookings
        WHERE space = ? ORDER BY date, start_hour""";
        try (var query = db.prepareStatement(sql)) {
            query.setString(1, space);
            var rows = query.executeQuery();
            List<Booking> bookings = new ArrayList<>();
            while (rows.next()) {
                bookings.add(
                    new Booking(
                        rows.getString("id"),
                        rows.getString("unit"),
                        rows.getString("date"),
                        rows.getInt("start_hour"),
                        rows.getInt("end_hour"),
                        rows.getLong("fee_cents")
                    )
                );
            }
            return new Schedule(s, bookings);
        } catch (SQLException error) {
            throw new IllegalStateException(error);
        }
    }

    public Schedule forBooking(String booking) {
        String sql = "SELECT space FROM bookings WHERE id = ?";
        try (var query = db.prepareStatement(sql)) {
            query.setString(1, booking);
            var rows = query.executeQuery();
            if (!rows.next()) throw new NotFoundError("booking not found");
            return forSpace(rows.getString(1));
        } catch (SQLException error) {
            throw new IllegalStateException(error);
        }
    }

    // Writes the schedule in one transaction: the aggregate is the unit of consistency
    public void save(Schedule schedule) {
        String space = schedule.space().id();
        try {
            db.setAutoCommit(false);
            try (
                var delete = db.prepareStatement(
                    "DELETE FROM bookings WHERE space = ?"
                );
                var insert = db.prepareStatement(
                    "INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
            ) {
                delete.setString(1, space);
                delete.executeUpdate();
                for (Booking b : schedule.bookings()) {
                    insert.setString(1, b.id());
                    insert.setString(2, space);
                    insert.setString(3, b.unit());
                    insert.setString(4, b.date());
                    insert.setInt(5, b.start());
                    insert.setInt(6, b.end());
                    insert.setLong(7, b.feeCents());
                    insert.executeUpdate();
                }
                db.commit();
            } catch (SQLException error) {
                db.rollback();
                throw error;
            } finally {
                db.setAutoCommit(true);
            }
        } catch (SQLException error) {
            throw new IllegalStateException(error);
        }
    }
}
