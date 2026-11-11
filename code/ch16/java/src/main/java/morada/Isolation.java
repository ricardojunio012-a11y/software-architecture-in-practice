// The "isolation" version: two reserve fund withdrawals, always interleaved in the
// same order, under three isolation levels. Each transaction checks the balance
// before recording its withdrawal, and even so the balance can go negative.
package morada;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class Isolation {

    static final String SERIALIZATION_FAILURE = "40001";
    static final List<String> LOG = new ArrayList<>();

    static Connection transaction(String url, int level) throws SQLException {
        Connection t = Database.connect(url);
        t.setAutoCommit(false);
        t.setTransactionIsolation(level);
        return t;
    }

    // A whole withdrawal, with no interleaving: used on the retry
    static void retry(Connection t, int amount, String reason) throws SQLException {
        int read = Fund.balance(t, 1);
        LOG.add("T2 reads the balance: " + Fund.dollars(read));
        if (read < amount) {
            String refused = "T2 refuses the withdrawal of " + Fund.dollars(amount);
            LOG.add(refused + ": insufficient balance");
            t.rollback();
            return;
        }
        Fund.insertWithdrawal(t, 1, amount, reason);
        t.commit();
        LOG.add("T2 records a withdrawal of " + Fund.dollars(amount) + " and commits");
    }

    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]);
        String url = System.getenv("DATABASE_URL");
        Map<String, Integer> levels = new LinkedHashMap<>();
        levels.put("READ COMMITTED", Connection.TRANSACTION_READ_COMMITTED);
        levels.put("REPEATABLE READ", Connection.TRANSACTION_REPEATABLE_READ);
        levels.put("SERIALIZABLE", Connection.TRANSACTION_SERIALIZABLE);
        try (var db = Database.connect(url)) {
            Database.resetSchema(db);
            Migrations.apply(db, data.resolve("migrations"));
            for (var level : levels.entrySet()) {
                LOG.add("== " + level.getKey());
                Fund.setUp(db);
                // The transaction begins at the first command on each connection
                try (
                    var t1 = transaction(url, level.getValue());
                    var t2 = transaction(url, level.getValue())
                ) {
                    LOG.add("T1 and T2 begin");
                    int read1 = Fund.balance(t1, 1);
                    LOG.add("T1 reads the balance: " + Fund.dollars(read1));
                    int read2 = Fund.balance(t2, 1);
                    LOG.add("T2 reads the balance: " + Fund.dollars(read2));
                    if (read1 >= 70000) {
                        Fund.insertWithdrawal(t1, 1, 70000, "gate repair");
                        LOG.add("T1 records a withdrawal of " + Fund.dollars(70000));
                    }
                    if (read2 >= 60000) {
                        Fund.insertWithdrawal(t2, 1, 60000, "facade painting");
                        LOG.add("T2 records a withdrawal of " + Fund.dollars(60000));
                    }
                    t1.commit();
                    LOG.add("T1 commits");
                    try {
                        t2.commit();
                        LOG.add("T2 commits");
                    } catch (SQLException error) {
                        if (
                            !SERIALIZATION_FAILURE.equals(error.getSQLState())
                        ) throw error;
                        LOG.add(
                            "T2 cannot commit: serialization failure; it tries again"
                        );
                        t2.rollback();
                        retry(t2, 60000, "facade painting");
                    }
                }
                int finalBalance = Fund.balance(db, 1);
                String warning =
                    finalBalance < 0 ? " (negative: the rule was broken)" : "";
                LOG.add("final balance: " + Fund.dollars(finalBalance) + warning);
                LOG.add("");
            }
        }
        Path output = data.resolve("output/isolation");
        Files.createDirectories(output);
        Files.writeString(output.resolve("run.txt"), String.join("\n", LOG));
        System.out.println("isolation: three levels run");
    }
}
