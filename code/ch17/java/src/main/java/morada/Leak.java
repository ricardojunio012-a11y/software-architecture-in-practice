// The "leak" version: the board president of community 12 opens the delinquency
// report, first without RLS and then with RLS. Then management company 3, which
// manages communities 12 and 15, opens the same report. The faulty query is the same
// in every case.
package morada;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import morada.Report.Delinquent;

public class Leak {

    static final int BOARD_PRESIDENT = 12;
    static final int MANAGEMENT_COMPANY = 3; // manages communities 12 and 15
    static final String REJECTED_BY_POLICY = "42501";
    static final List<String> LOG = new ArrayList<>();

    static String dollars(int cents) {
        return String.format(Locale.US, "$%,.2f", cents / 100.0);
    }

    static void show(int step, String title, List<Delinquent> rows) {
        show(step, title, rows, List.of(BOARD_PRESIDENT));
    }

    static void show(
        int step,
        String title,
        List<Delinquent> rows,
        List<Integer> allowed
    ) {
        LOG.add(step + ". " + title);
        long leaked = 0;
        for (Delinquent r : rows) {
            boolean other = !allowed.contains(r.community());
            if (other) leaked++;
            String warning = other ? "  <- another community" : "";
            LOG.add(
                "   community " +
                    r.community() +
                    " | unit " +
                    r.unit() +
                    " | " +
                    r.resident() +
                    " | " +
                    dollars(r.amount()) +
                    warning
            );
        }
        if (rows.isEmpty()) LOG.add("   no rows");
        LOG.add("   rows from other communities: " + leaked);
        LOG.add("");
    }

    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]);
        try (
            var admin = Database.connect(System.getenv("DATABASE_URL"));
            var app = Database.connect(System.getenv("APP_DATABASE_URL"));
            var sql = admin.createStatement()
        ) {
            sql.execute(Files.readString(data.resolve("sql/schema.sql")));
            show(
                1,
                "board president's report for community 12, without RLS",
                Database.asCommunity(app, BOARD_PRESIDENT, () ->
                    Report.delinquents(app)
                )
            );
            sql.execute(Files.readString(data.resolve("sql/rls.sql")));
            show(
                2,
                "the same report, with RLS",
                Database.asCommunity(app, BOARD_PRESIDENT, () ->
                    Report.delinquents(app)
                )
            );
            show(
                3,
                "with RLS, in a transaction with no community set",
                Database.asCommunity(app, null, () -> Report.delinquents(app))
            );

            LOG.add(
                "4. with RLS, community 12 tries to write a charge for community 15"
            );
            String columns = "(community_id, unit, resident, amount_cents, status) ";
            try {
                Database.asCommunity(app, BOARD_PRESIDENT, () -> {
                    try (var insert = app.createStatement()) {
                        return insert.executeUpdate(
                            "INSERT INTO charges " +
                                columns +
                                "VALUES (15, '13', 'Hugh Davis', 38000, 'open')"
                        );
                    }
                });
                LOG.add("   written");
            } catch (SQLException error) {
                if (!REJECTED_BY_POLICY.equals(error.getSQLState())) throw error;
                LOG.add("   rejected by the database: the row fails the RLS policy");
            }

            show(
                5,
                "with RLS, management company 3, which manages communities 12 and 15",
                Database.asManagementCompany(app, MANAGEMENT_COMPANY, () ->
                    Report.delinquents(app)
                ),
                List.of(12, 15)
            );
            LOG.add(
                "6. with RLS, management company 3 tries to write a charge for community 20"
            );
            try {
                Database.asManagementCompany(app, MANAGEMENT_COMPANY, () -> {
                    try (var insert = app.createStatement()) {
                        return insert.executeUpdate(
                            "INSERT INTO charges " +
                                columns +
                                "VALUES (20, 'A-5', 'Hugh Davis', 61000, 'open')"
                        );
                    }
                });
                LOG.add("   written");
            } catch (SQLException error) {
                if (!REJECTED_BY_POLICY.equals(error.getSQLState())) throw error;
                LOG.add("   rejected by the database: the row fails every policy");
            }
        }
        Path output = data.resolve("output/leak");
        Files.createDirectories(output);
        Files.writeString(output.resolve("report.txt"), String.join("\n", LOG) + "\n");
        System.out.println("leak: six steps run");
    }
}
