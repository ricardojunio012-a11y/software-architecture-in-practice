// The reserve fund: the balance is the sum of the entries, and a withdrawal can only
// be recorded if there is enough balance.
package morada;

import java.sql.Connection;
import java.sql.SQLException;

public final class Fund {

    private Fund() {}

    public static void setUp(Connection db) throws SQLException {
        try (var sql = db.createStatement()) {
            sql.execute("TRUNCATE entries");
            sql.execute("INSERT INTO funds VALUES (1, 1234) ON CONFLICT DO NOTHING");
            sql.execute(
                "INSERT INTO entries (fund_id, amount_cents, description) " +
                    "VALUES (1, 100000, 'opening balance')"
            );
        }
    }

    public static int balance(Connection db, int fund) throws SQLException {
        try (
            var query = db.prepareStatement(
                "SELECT coalesce(sum(amount_cents), 0)::int FROM entries " +
                    "WHERE fund_id = ?"
            )
        ) {
            query.setInt(1, fund);
            var row = query.executeQuery();
            row.next();
            return row.getInt(1);
        }
    }

    public static void insertWithdrawal(
        Connection db,
        int fund,
        int amount,
        String description
    ) throws SQLException {
        try (
            var insert = db.prepareStatement(
                "INSERT INTO entries (fund_id, amount_cents, description) " +
                    "VALUES (?, ?, ?)"
            )
        ) {
            insert.setInt(1, fund);
            insert.setInt(2, -amount);
            insert.setString(3, description);
            insert.executeUpdate();
        }
    }

    // The right way under READ COMMITTED: lock the fund row before reading the balance.
    // Two withdrawals from the same fund then happen one after the other.
    public static boolean recordWithdrawal(
        Connection db,
        int fund,
        int amount,
        String description
    ) throws SQLException {
        db.setAutoCommit(false);
        try (
            var lock = db.prepareStatement(
                "SELECT id FROM funds WHERE id = ? FOR UPDATE"
            )
        ) {
            lock.setInt(1, fund);
            lock.executeQuery();
            if (balance(db, fund) < amount) {
                db.rollback();
                return false;
            }
            insertWithdrawal(db, fund, amount, description);
            db.commit();
            return true;
        } catch (SQLException error) {
            db.rollback();
            throw error;
        } finally {
            db.setAutoCommit(true);
        }
    }

    // 123456 cents → "$1,234.56"; -30000 cents → "-$300.00"
    public static String dollars(int cents) {
        String sign = cents < 0 ? "-" : "";
        int absolute = Math.abs(cents);
        String whole = String.format(java.util.Locale.US, "%,d", absolute / 100);
        return sign + "$" + whole + "." + String.format("%02d", absolute % 100);
    }
}
