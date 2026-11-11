// The migrations run once each, in order, and a second run does nothing.
// There is no database while the image is built, so the test is skipped then.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class MigrationsTest {

    @Test
    void applyEachFileOnlyOnceInOrder() throws Exception {
        String url = System.getenv("DATABASE_URL");
        assumeTrue(url != null, "no database");
        try (var db = Database.connect(url)) {
            Database.resetSchema(db);
            Path folder = Path.of("/data/migrations");
            assertEquals(
                List.of(
                    "001_charges.sql",
                    "002_reserve_fund.sql",
                    "003_delinquency_index.sql"
                ),
                Migrations.apply(db, folder)
            );
            assertEquals(List.of(), Migrations.apply(db, folder));
        }
    }
}
