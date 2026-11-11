// Connection to PostgreSQL and a clean schema for each experiment.
package morada;

import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class Database {

    private Database() {}

    // DATABASE_URL: postgresql://user:password@host:port/database
    public static Connection connect(String url) throws SQLException {
        URI u = URI.create(url);
        String[] credentials = u.getUserInfo().split(":");
        return DriverManager.getConnection(
            "jdbc:postgresql://" + u.getHost() + ":" + u.getPort() + u.getPath(),
            credentials[0],
            credentials[1]
        );
    }

    public static void resetSchema(Connection db) throws SQLException {
        try (var sql = db.createStatement()) {
            sql.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
        }
    }
}
