// Usage: java morada.Main monolith|service <output-folder>
// Sends one notice per confirmed payment: through the module, in the same process,
// or through the extracted service, over the network. Counts what happened and
// measures the time of each notice.
package morada;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Main {

    static final ObjectMapper JSON = new ObjectMapper();
    // HTTP/1.1, like the clients in the other languages (no HTTP/2 attempt)
    static final HttpClient CLIENT = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .build();
    static final String URL = System.getenv("COMMUNICATIONS_URL");
    static int sent, calls, errors, retries, duplicates, lost;

    static int post(String address, Map<String, String> body, String[] status) {
        try {
            var request = HttpRequest.newBuilder(URI.create(address))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(2))
                .POST(BodyPublishers.ofString(JSON.writeValueAsString(body)))
                .build();
            var response = CLIENT.send(request, BodyHandlers.ofString());
            if (response.statusCode() == 200 && status != null) {
                status[0] = JSON.readTree(response.body()).path("status").asText();
            }
            return response.statusCode();
        } catch (Exception error) {
            return 0;
        }
    }

    // Over the network, each call can fail: try up to 3 times, always with the same id
    static void sendOverNetwork(String id, String text) {
        for (int attempt = 1; attempt <= 3; attempt++) {
            if (attempt > 1) {
                retries++;
                // Growing backoff (5 to 10 ms, then 10 to 20 ms), with jitter, so that
                // clients that failed together do not all come back at the same instant
                double cap = 10 * Math.pow(2, attempt - 2);
                long ms = Math.round(cap / 2 + Math.random() * (cap / 2));
                try {
                    Thread.sleep(ms);
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                }
            }
            calls++;
            String[] status = new String[1];
            int code = post(URL + "/notices", Map.of("id", id, "text", text), status);
            if (code == 200) {
                if ("duplicate".equals(status[0])) duplicates++;
                sent++;
                return;
            }
            errors++;
        }
        lost++;
    }

    public static void main(String[] args) throws Exception {
        String version = args[0];
        int notices = JSON.readTree(Path.of("/data/input/load.json").toFile())
            .get("notices")
            .asInt();
        var communications = new Communications();
        if (version.equals("service")) post(URL + "/reset", Map.of(), null);
        List<Double> times = new ArrayList<>();
        long start = System.nanoTime();
        for (int i = 1; i <= notices; i++) {
            String id = String.format("E-P-%03d", i);
            String text = "payment " + id.substring(2) + " received";
            long t0 = System.nanoTime();
            if (version.equals("service")) sendOverNetwork(id, text);
            else if (communications.send(id, text)) sent++;
            times.add((System.nanoTime() - t0) / 1e6);
        }
        double total = (System.nanoTime() - start) / 1e6;

        Path outDir = Path.of(args[1]);
        Files.createDirectories(outDir.resolve(version));
        Files.writeString(
            outDir.resolve(version).resolve("result.txt"),
            String.join(
                "\n",
                "notices sent: " + sent,
                "network calls: " + calls,
                "error responses: " + errors,
                "retries: " + retries,
                "duplicate notices ignored: " + duplicates,
                "notices lost: " + lost
            ) + "\n"
        );
        // Times vary from machine to machine: they stay out of the verified folder
        List<Double> sorted = times.stream().sorted().toList();
        double mean = times
            .stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0);
        Files.writeString(
            outDir.resolve("times-" + version + ".txt"),
            String.format(
                java.util.Locale.ROOT,
                "mean time per notice: %.3f ms%np95 per notice: %.3f ms%n" +
                    "worst notice: %.3f ms%ntotal time: %.3f ms%n",
                mean,
                sorted.get((int) (sorted.size() * 0.95)),
                sorted.get(sorted.size() - 1),
                total
            )
        );
        System.out.println(version + ": " + sent + " notices; output in " + outDir);
    }
}
