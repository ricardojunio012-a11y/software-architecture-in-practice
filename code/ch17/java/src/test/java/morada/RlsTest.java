// Row-Level Security in PostgreSQL: a query with no filter sees only the
// transaction's community, and writing to another community is rejected. The
// management company sees the communities it manages, and only those. There is no
// database while the image is built, so the tests are skipped there.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class RlsTest {

    @Test
    void isolatesReadsAndWritesByCommunity() throws Exception {
        String url = System.getenv("DATABASE_URL");
        assumeTrue(url != null, "no database");
        try (
            var admin = Database.connect(url);
            var app = Database.connect(System.getenv("APP_DATABASE_URL"));
            var sql = admin.createStatement()
        ) {
            sql.execute(Files.readString(Path.of("/data/sql/schema.sql")));
            sql.execute(Files.readString(Path.of("/data/sql/rls.sql")));
            List<Integer> communities = Database.asCommunity(app, 15, () -> {
                List<Integer> list = new ArrayList<>();
                try (var query = app.createStatement()) {
                    var rows = query.executeQuery(
                        "SELECT DISTINCT community_id FROM charges"
                    );
                    while (rows.next()) list.add(rows.getInt(1));
                }
                return list;
            });
            assertEquals(List.of(15), communities);
            String columns = "(community_id, unit, resident, amount_cents, status) ";
            var error = assertThrows(SQLException.class, () ->
                Database.asCommunity(app, 15, () -> {
                    try (var insert = app.createStatement()) {
                        return insert.executeUpdate(
                            "INSERT INTO charges " +
                                columns +
                                "VALUES (20, 'B-1', 'Iris Moore', 61000, 'open')"
                        );
                    }
                })
            );
            assertEquals("42501", error.getSQLState());
        }
    }

    @Test
    void aManagementCompanySeesOnlyTheCommunitiesItManages() throws Exception {
        String url = System.getenv("DATABASE_URL");
        assumeTrue(url != null, "no database");
        try (
            var admin = Database.connect(url);
            var app = Database.connect(System.getenv("APP_DATABASE_URL"));
            var sql = admin.createStatement()
        ) {
            sql.execute(Files.readString(Path.of("/data/sql/schema.sql")));
            sql.execute(Files.readString(Path.of("/data/sql/rls.sql")));
            List<Integer> communities = Database.asManagementCompany(app, 3, () -> {
                List<Integer> list = new ArrayList<>();
                try (var query = app.createStatement()) {
                    var rows = query.executeQuery(
                        "SELECT DISTINCT community_id FROM charges ORDER BY 1"
                    );
                    while (rows.next()) list.add(rows.getInt(1));
                }
                return list;
            });
            assertEquals(List.of(12, 15), communities);
        }
    }
}
