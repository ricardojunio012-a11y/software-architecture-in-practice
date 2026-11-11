// Connection to PostgreSQL and transactions on behalf of a community or a management
// company.
package morada;

import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class Database {

    private Database() {}

    public interface Work<T> {
        T run() throws SQLException;
    }

    // URL: postgresql://user:password@host:port/database
    public static Connection connect(String url) throws SQLException {
        URI u = URI.create(url);
        String[] credentials = u.getUserInfo().split(":");
        return DriverManager.getConnection(
            "jdbc:postgresql://" + u.getHost() + ":" + u.getPort() + u.getPath(),
            credentials[0],
            credentials[1]
        );
    }

    // Runs a unit of work in a transaction on behalf of the requester. The "true" in
    // set_config makes the value last only for this transaction: on a connection
    // reused from a pool, the previous request's community is not left over for the
    // next one.
    private static <T> T onBehalfOf(
        Connection db,
        String setting,
        Integer value,
        Work<T> work
    ) throws SQLException {
        db.setAutoCommit(false);
        try {
            if (value != null) {
                try (
                    var config = db.prepareStatement("SELECT set_config(?, ?, true)")
                ) {
                    config.setString(1, setting);
                    config.setString(2, value.toString());
                    config.executeQuery();
                }
            }
            T result = work.run();
            db.commit();
            return result;
        } catch (SQLException error) {
            db.rollback();
            throw error;
        } finally {
            db.setAutoCommit(true);
        }
    }

    // The board president acts on behalf of one community. The management company
    // acts on behalf of every community it manages, which the database policy looks
    // up in the managed_communities table.
    public static <T> T asCommunity(Connection db, Integer community, Work<T> work)
        throws SQLException {
        return onBehalfOf(db, "app.community", community, work);
    }

    public static <T> T asManagementCompany(
        Connection db,
        int managementCompany,
        Work<T> work
    ) throws SQLException {
        return onBehalfOf(db, "app.management_company", managementCompany, work);
    }
}
