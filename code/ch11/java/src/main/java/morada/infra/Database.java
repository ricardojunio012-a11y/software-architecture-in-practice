// The Billing database: the payments and, in the outbox version, the table of events
// to publish, saved in the same transaction as the payment.
package morada.infra;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import morada.Events.Payment;
import morada.Events.PaymentConfirmed;

public class Database {

    private static final ObjectMapper JSON = new ObjectMapper();

    // DATABASE_URL: postgresql://user:password@host:port/database
    public static Connection connect() throws Exception {
        URI u = URI.create(System.getenv("DATABASE_URL"));
        String[] credentials = u.getUserInfo().split(":");
        String jdbc =
            "jdbc:postgresql://" + u.getHost() + ":" + u.getPort() + u.getPath();
        Connection db = DriverManager.getConnection(
            jdbc,
            credentials[0],
            credentials[1]
        );
        try (var sql = db.createStatement()) {
            sql.execute("DROP TABLE IF EXISTS outbox, payments");
            sql.execute(
                "CREATE TABLE payments (id text PRIMARY KEY, unit text, " +
                    "booking text, amount_cents integer)"
            );
            sql.execute(
                "CREATE TABLE outbox (id serial PRIMARY KEY, event text UNIQUE, " +
                    "payload text, published boolean NOT NULL DEFAULT false)"
            );
        }
        return db;
    }

    public static void savePayment(Connection db, Payment p) throws SQLException {
        try (
            var sql = db.prepareStatement("INSERT INTO payments VALUES (?, ?, ?, ?)")
        ) {
            sql.setString(1, p.payment());
            sql.setString(2, p.unit());
            sql.setString(3, p.booking());
            sql.setLong(4, p.amountCents());
            sql.executeUpdate();
        }
    }

    // Payment and event in the same transaction: either both are saved, or neither is
    public static void saveWithOutbox(Connection db, Payment p, PaymentConfirmed e)
        throws Exception {
        db.setAutoCommit(false);
        try {
            savePayment(db, p);
            try (
                var sql = db.prepareStatement(
                    "INSERT INTO outbox (event, payload) VALUES (?, ?)"
                )
            ) {
                sql.setString(1, e.event());
                sql.setString(2, JSON.writeValueAsString(e));
                sql.executeUpdate();
            }
            db.commit();
        } catch (Exception error) {
            db.rollback();
            throw error;
        } finally {
            db.setAutoCommit(true);
        }
    }
}
