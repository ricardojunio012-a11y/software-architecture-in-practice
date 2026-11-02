// Composition root: the only place that picks the adapters and wires them to the core.
package morada.main;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import morada.adapters.outbound.InMemorySchedules;
import morada.adapters.outbound.PostgresSchedules;
import morada.application.BookingService;
import morada.application.ScheduleRepository;
import morada.domain.Schedule.Space;

public class Assemble {

    public record Assembled(BookingService service, ScheduleRepository schedules) {}

    public static Assembled assemble(String repository, boolean prepare)
        throws Exception {
        var json = new ObjectMapper();
        JsonNode data = json.readTree(Path.of("/data/input/spaces.json").toFile());
        List<Space> spaces = new ArrayList<>();
        for (JsonNode s : data.get("spaces")) {
            spaces.add(json.treeToValue(s, Space.class));
        }
        if (repository.equals("memory")) {
            var schedules = new InMemorySchedules(spaces);
            return new Assembled(new BookingService(schedules), schedules);
        }
        var schedules = new PostgresSchedules(connect(), spaces);
        if (prepare) schedules.prepare();
        return new Assembled(new BookingService(schedules), schedules);
    }

    // DATABASE_URL: postgresql://user:password@host:port/database
    public static java.sql.Connection connect() throws Exception {
        URI u = URI.create(System.getenv("DATABASE_URL"));
        String[] credentials = u.getUserInfo().split(":");
        String jdbc =
            "jdbc:postgresql://" + u.getHost() + ":" + u.getPort() + u.getPath();
        return DriverManager.getConnection(jdbc, credentials[0], credentials[1]);
    }
}
