// Integration tests: the repository against a real PostgreSQL, in a container.
// There is no database while the image is built, so they are skipped there.
package morada;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import morada.communications.PostgresNotices;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class IntegrationTest {

    @BeforeEach
    void needsDatabase() {
        assumeTrue(System.getenv("DATABASE_URL") != null, "no database");
    }

    @Test
    void recordsANoticeAndFindsItLater() throws Exception {
        try (var notices = PostgresNotices.connect(System.getenv("DATABASE_URL"))) {
            assertFalse(notices.alreadySent("E-1"));
            notices.record("E-1", "payment received");
            assertTrue(notices.alreadySent("E-1"));
        }
    }

    @Test
    void theDatabaseRejectsTheSameNoticeTwice() throws Exception {
        try (var notices = PostgresNotices.connect(System.getenv("DATABASE_URL"))) {
            notices.record("E-1", "payment received");
            assertThrows(IllegalStateException.class, () ->
                notices.record("E-1", "payment received")
            );
        }
    }
}
