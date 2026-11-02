// Notice repository in PostgreSQL. The primary key guarantees, in the database,
// that the same notice is not saved twice.
package morada.communications;

import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import morada.communications.Communications.NoticeRepository;

public class PostgresNotices implements NoticeRepository, AutoCloseable {

    private final Connection db;

    private PostgresNotices(Connection db) {
        this.db = db;
    }

    // DATABASE_URL: postgresql://user:password@host:port/database
    public static PostgresNotices connect(String url) throws SQLException {
        URI u = URI.create(url);
        String[] credentials = u.getUserInfo().split(":");
        Connection db = DriverManager.getConnection(
            "jdbc:postgresql://" + u.getHost() + ":" + u.getPort() + u.getPath(),
            credentials[0],
            credentials[1]
        );
        try (var sql = db.createStatement()) {
            sql.execute("DROP TABLE IF EXISTS notices");
            sql.execute(
                "CREATE TABLE notices (id text PRIMARY KEY, text text NOT NULL)"
            );
        }
        return new PostgresNotices(db);
    }

    public boolean alreadySent(String id) {
        try (var query = db.prepareStatement("SELECT 1 FROM notices WHERE id = ?")) {
            query.setString(1, id);
            return query.executeQuery().next();
        } catch (SQLException error) {
            throw new IllegalStateException(error);
        }
    }

    public void record(String id, String text) {
        try (var sql = db.prepareStatement("INSERT INTO notices VALUES (?, ?)")) {
            sql.setString(1, id);
            sql.setString(2, text);
            sql.executeUpdate();
        } catch (SQLException error) {
            throw new IllegalStateException(error);
        }
    }

    public void close() throws SQLException {
        db.close();
    }
}
