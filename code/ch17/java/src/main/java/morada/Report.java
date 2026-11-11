// The board president's delinquency report, with the defect the chapter uses to show
// the leak: the query forgot the community filter.
package morada;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class Report {

    private Report() {}

    public record Delinquent(int community, String unit, String resident, int amount) {}

    public static List<Delinquent> delinquents(Connection db) throws SQLException {
        List<Delinquent> list = new ArrayList<>();
        try (var sql = db.createStatement()) {
            var rows = sql.executeQuery(
                """
                SELECT community_id, unit, resident, amount_cents
                FROM charges
                WHERE status = 'open' -- missing: AND community_id = ?
                ORDER BY community_id, unit"""
            );
            while (rows.next()) {
                list.add(
                    new Delinquent(
                        rows.getInt(1),
                        rows.getString(2),
                        rows.getString(3),
                        rows.getInt(4)
                    )
                );
            }
        }
        return list;
    }
}
