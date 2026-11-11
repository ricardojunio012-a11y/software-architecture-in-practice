// The "noisy" version: a server handles one request at a time, in order of arrival,
// and each request takes serviceMs. With no limit, one community's burst fills the
// queue and delays everyone. With a token bucket per community, the burst is
// rejected (429) and the others barely wait. Time is simulated, and the result is
// always the same.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public class Noisy {

    record Request(int t, int community) {}

    static List<String> simulate(
        List<Request> requests,
        int serviceMs,
        JsonNode limit
    ) {
        Map<Integer, Integer> rejected = new TreeMap<>();
        Map<Integer, List<Integer>> waits = new TreeMap<>();
        Map<Integer, TokenBucket> buckets = new TreeMap<>();
        int freeAt = 0;
        for (Request r : requests) {
            rejected.putIfAbsent(r.community(), 0);
            waits.putIfAbsent(r.community(), new ArrayList<>());
            if (limit != null) {
                var bucket = buckets.computeIfAbsent(r.community(), c ->
                    new TokenBucket(
                        limit.get("burst").asInt(),
                        limit.get("perSecond").asInt()
                    )
                );
                if (!bucket.allows(r.t())) {
                    rejected.merge(r.community(), 1, Integer::sum);
                    continue;
                }
            }
            // The request waits for the server to finish what arrived before it
            int start = Math.max(r.t(), freeAt);
            waits.get(r.community()).add(start - r.t());
            freeAt = start + serviceMs;
        }
        List<String> lines = new ArrayList<>();
        for (var e : waits.entrySet()) {
            List<Integer> list = e.getValue();
            int sum = list.stream().mapToInt(Integer::intValue).sum();
            int average = list.isEmpty() ? 0 : sum / list.size();
            int max = list.stream().mapToInt(Integer::intValue).max().orElse(0);
            int refusals = rejected.get(e.getKey());
            lines.add(
                "community " +
                    e.getKey() +
                    ": " +
                    (list.size() + refusals) +
                    " requests, " +
                    list.size() +
                    " served, " +
                    refusals +
                    " rejected, " +
                    "average wait " +
                    average +
                    " ms, max " +
                    max +
                    " ms"
            );
        }
        return lines;
    }

    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]);
        JsonNode scenario = new ObjectMapper().readTree(
            data.resolve("input/noisy.json").toFile()
        );
        int duration = scenario.get("durationMs").asInt();
        List<Request> requests = new ArrayList<>();
        for (JsonNode c : scenario.get("clients")) {
            for (
                int t = c.get("startMs").asInt();
                t < duration;
                t += c.get("intervalMs").asInt()
            ) {
                requests.add(new Request(t, c.get("community").asInt()));
            }
        }
        requests.sort(
            Comparator.comparingInt(Request::t).thenComparingInt(Request::community)
        );

        int service = scenario.get("serviceMs").asInt();
        JsonNode limit = scenario.get("limit");
        List<String> result = new ArrayList<>();
        result.add("== no limit");
        result.addAll(simulate(requests, service, null));
        result.add("");
        result.add(
            "== with a per-community limit (burst of " +
                limit.get("burst").asInt() +
                ", " +
                limit.get("perSecond").asInt() +
                " per second)"
        );
        result.addAll(simulate(requests, service, limit));

        Path output = data.resolve("output/noisy");
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("result.txt"),
            String.join("\n", result) + "\n"
        );
        System.out.println("noisy: " + requests.size() + " requests simulated");
    }
}
