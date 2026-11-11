// The "query" version: the delinquency query over 1 million charges, with no index,
// with an index on the wrong column, and with the right index, created by
// migration 003. The plans go to output/query; the times, which vary, go only to the
// terminal.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

public class Query {

    static final List<String> PLANS = new ArrayList<>();

    // The nodes that read data (table and index scans), from the JSON plan
    static List<String> scans(JsonNode node) {
        List<String> children = new ArrayList<>();
        for (JsonNode child : node.path("Plans")) children.addAll(scans(child));
        if (!node.has("Relation Name") && !node.has("Index Name")) return children;
        String table = node.has("Relation Name")
            ? " on " + node.get("Relation Name").asText()
            : "";
        String index = node.has("Index Name")
            ? " using index " + node.get("Index Name").asText()
            : "";
        long discarded = node.path("Rows Removed by Filter").asLong(0);
        String rows =
            node.get("Actual Rows").asLong() +
            " rows kept, " +
            discarded +
            " discarded";
        List<String> result = new ArrayList<>();
        result.add(node.get("Node Type").asText() + table + index + ": " + rows);
        result.addAll(children);
        return result;
    }

    static void plan(Connection db, String query, String title) throws Exception {
        try (var sql = db.createStatement()) {
            var row = sql.executeQuery("EXPLAIN (ANALYZE, FORMAT JSON) " + query);
            row.next();
            JsonNode explained = new ObjectMapper().readTree(row.getString(1)).get(0);
            PLANS.add(PLANS.size() / 3 + 1 + ". " + title);
            for (String l : scans(explained.get("Plan"))) PLANS.add("   " + l);
            PLANS.add("");
            double time = explained.get("Execution Time").asDouble();
            System.out.printf("%s: %.1f ms%n", title, time);
        }
    }

    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]);
        Path migrationsFolder = data.resolve("migrations");
        try (var db = Database.connect(System.getenv("DATABASE_URL"))) {
            Database.resetSchema(db);
            List<String> applied = new ArrayList<>(
                Migrations.apply(db, migrationsFolder, 2)
            );
            var sql = db.createStatement();
            sql.execute(Files.readString(data.resolve("input/charges.sql")));
            sql.execute("ANALYZE charges");
            // Without parallelism, the plan is the same on any machine and easier to
            // read
            sql.execute("SET max_parallel_workers_per_gather = 0");
            String query = Files.readString(data.resolve("input/delinquency.sql"));

            plan(db, query, "no index");
            sql.execute("CREATE INDEX charges_due_date ON charges (due_date)");
            sql.execute("ANALYZE charges");
            plan(db, query, "index on due date only");
            sql.execute("DROP INDEX charges_due_date");
            applied.addAll(Migrations.apply(db, migrationsFolder));
            sql.execute("ANALYZE charges");
            plan(db, query, "index from migration 003");

            List<String> result = new ArrayList<>();
            var rows = sql.executeQuery(query);
            while (rows.next()) {
                String unit = rows.getString("unit");
                long charges = rows.getLong("charges");
                long total = rows.getLong("total_cents");
                result.add(
                    String.format(
                        "unit %s: open charges %d, total %d cents",
                        unit,
                        charges,
                        total
                    )
                );
            }

            Path output = data.resolve("output/query");
            Files.createDirectories(output);
            Files.writeString(output.resolve("plans.txt"), String.join("\n", PLANS));
            Files.writeString(
                output.resolve("result.txt"),
                String.join("\n", result) + "\n"
            );
            Files.writeString(
                output.resolve("migrations.txt"),
                String.join("\n", applied) + "\n"
            );
        }
    }
}
