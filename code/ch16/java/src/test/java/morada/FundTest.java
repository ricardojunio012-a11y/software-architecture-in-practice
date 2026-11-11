// The reserve fund: formatting in dollars, and two simultaneous withdrawals with the
// fund row locked, which never leave the balance negative.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;

class FundTest {

    @Test
    void dollarsFormatsCentsWithThousandsSeparatorAndSign() {
        assertEquals("$1,000.00", Fund.dollars(100000));
        assertEquals("-$300.00", Fund.dollars(-30000));
        assertEquals("$0.05", Fund.dollars(5));
    }

    @Test
    void simultaneousWithdrawalsWithTheFundLockedNeverGoNegative() throws Exception {
        String url = System.getenv("DATABASE_URL");
        assumeTrue(url != null, "no database");
        try (var db = Database.connect(url)) {
            Database.resetSchema(db);
            Migrations.apply(db, Path.of("/data/migrations"));
            Fund.setUp(db);
            List<Callable<Boolean>> withdrawals = List.of(
                () -> {
                    try (var c = Database.connect(url)) {
                        return Fund.recordWithdrawal(c, 1, 70000, "gate repair");
                    }
                },
                () -> {
                    try (var c = Database.connect(url)) {
                        return Fund.recordWithdrawal(c, 1, 60000, "facade painting");
                    }
                }
            );
            try (var pool = Executors.newFixedThreadPool(2)) {
                long recorded = 0;
                for (var future : pool.invokeAll(withdrawals))
                    if (future.get()) recorded++;
                assertEquals(1, recorded);
            }
            assertTrue(Fund.balance(db, 1) >= 0);
        }
    }
}
