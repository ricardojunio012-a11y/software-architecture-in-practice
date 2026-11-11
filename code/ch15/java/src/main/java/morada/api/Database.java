// The API's database: communities, charges, payments and idempotency keys. The
// primary key of the keys table, (management_company, key), guarantees a single
// processing per key of each client, even with simultaneous requests.
package morada.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class Database {

    private Database() {}

    static final String TABLES = """
    DROP TABLE IF EXISTS idempotency_keys, payments, charges, communities;
    DROP SEQUENCE IF EXISTS payments_seq;
    CREATE TABLE communities (id text PRIMARY KEY, management_company text NOT NULL);
    CREATE TABLE charges (
      id text PRIMARY KEY,
      community text NOT NULL REFERENCES communities,
      unit text NOT NULL,
      due_date date NOT NULL,
      amount_cents integer NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE payments (
      id text PRIMARY KEY,
      charge text NOT NULL UNIQUE REFERENCES charges,
      amount_cents integer NOT NULL
    );
    CREATE SEQUENCE payments_seq;
    CREATE TABLE idempotency_keys (
      management_company text,
      key text,
      request text NOT NULL,
      status integer,
      response text,
      PRIMARY KEY (management_company, key)
    )""";

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

    public static void prepare(String url, String chargesFile) throws Exception {
        try (var db = connect(url)) {
            try (var sql = db.createStatement()) {
                sql.execute(TABLES);
            }
            // Who manages each community is in communities.json, next to the charges
            var json = new ObjectMapper();
            File folder = new File(chargesFile).getParentFile();
            var community = db.prepareStatement(
                "INSERT INTO communities VALUES (?, ?)"
            );
            for (JsonNode c : json.readTree(new File(folder, "communities.json"))) {
                community.setString(1, c.get("id").asText());
                community.setString(2, c.get("managementCompany").asText());
                community.executeUpdate();
            }
            var charge = db.prepareStatement(
                "INSERT INTO charges VALUES (?, ?, ?, ?::date, ?, ?)"
            );
            for (JsonNode c : json.readTree(new File(chargesFile))) {
                charge.setString(1, c.get("id").asText());
                charge.setString(2, c.get("community").asText());
                charge.setString(3, c.get("unit").asText());
                charge.setString(4, c.get("dueDate").asText());
                charge.setInt(5, c.get("amountCents").asInt());
                charge.setString(6, c.get("status").asText());
                charge.executeUpdate();
            }
        }
    }
}
