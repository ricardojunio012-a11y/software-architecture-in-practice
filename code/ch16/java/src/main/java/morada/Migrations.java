// Versioned migrations: each file in migrations/ runs only once, in order, and is
// recorded in the applied_migrations table. A file that starts with
// "-- no transaction" runs outside a transaction (CREATE INDEX CONCURRENTLY needs it).
package morada;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class Migrations {

    private Migrations() {}

    public static List<String> apply(Connection db, Path folder)
        throws IOException, SQLException {
        return apply(db, folder, Integer.MAX_VALUE);
    }

    public static List<String> apply(Connection db, Path folder, int upTo)
        throws IOException, SQLException {
        try (var sql = db.createStatement()) {
            sql.execute(
                """
                CREATE TABLE IF NOT EXISTS applied_migrations (
                  version text PRIMARY KEY,
                  applied_at timestamptz NOT NULL DEFAULT now()
                )"""
            );
        }
        Set<String> done = new HashSet<>();
        try (var sql = db.createStatement()) {
            var rows = sql.executeQuery("SELECT version FROM applied_migrations");
            while (rows.next()) done.add(rows.getString(1));
        }
        List<String> files;
        try (var list = Files.list(folder)) {
            files = list
                .map(p -> p.getFileName().toString())
                .filter(name -> name.endsWith(".sql"))
                .sorted()
                .toList();
        }
        List<String> applied = new ArrayList<>();
        for (String file : files) {
            if (Integer.parseInt(file.split("_")[0]) > upTo) break;
            if (done.contains(file)) continue;
            String content = Files.readString(folder.resolve(file));
            boolean noTransaction = content.startsWith("-- no transaction");
            // The migration and its record go in together, or neither does
            db.setAutoCommit(noTransaction);
            try (
                var sql = db.createStatement();
                var record = db.prepareStatement(
                    "INSERT INTO applied_migrations (version) VALUES (?)"
                )
            ) {
                sql.execute(content);
                record.setString(1, file);
                record.executeUpdate();
                if (!noTransaction) db.commit();
            } catch (SQLException error) {
                if (!noTransaction) db.rollback();
                throw error;
            } finally {
                db.setAutoCommit(true);
            }
            applied.add(file);
        }
        return applied;
    }
}
