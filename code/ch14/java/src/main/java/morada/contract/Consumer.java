// Consumer-side contract test. A test double answers exactly what each interaction
// promises; the monolith's real client talks to it. If the client understands every
// response, the interactions become the published contract.
package morada.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.communications.Api;
import morada.contract.Interactions.Interaction;
import morada.monolith.CommunicationsClient;
import morada.monolith.CommunicationsClient.Result;

public class Consumer {

    static Interaction current;

    public static void main(String[] args) throws Exception {
        var json = new ObjectMapper();
        // The provider double: checks the request and returns the agreed response
        var providerDouble = HttpServer.create(
            new InetSocketAddress("127.0.0.1", 0),
            0
        );
        providerDouble.createContext("/", exchange -> {
            var body = json.readTree(exchange.getRequestBody());
            var expected = current.request();
            boolean same =
                exchange.getRequestMethod().equals(expected.method()) &&
                exchange.getRequestURI().getPath().equals(expected.path()) &&
                body.equals(json.valueToTree(expected.body()));
            if (same) Api.respond(
                exchange,
                current.response().status(),
                current.response().body()
            );
            else Api.respond(exchange, 500, Map.of("error", "unexpected request"));
        });
        var client = new CommunicationsClient(Api.start(providerDouble));

        // What the monolith must understand from each response
        Map<String, Result> expected = Map.of(
            "sending a new notice",
            new Result(true, false, null),
            "resending a notice already sent",
            new Result(true, true, null),
            "notice without text",
            new Result(false, false, "text is required")
        );

        List<String> report = new ArrayList<>();
        for (Interaction interaction : Interactions.INTERACTIONS) {
            current = interaction;
            var body = interaction.request().body();
            var result = client.send(body.get("id"), body.get("text"));
            boolean ok = result.equals(expected.get(interaction.description()));
            report.add(
                interaction.description() +
                    ": " +
                    (ok ? "the client understood" : "FAILED")
            );
        }
        providerDouble.stop(0);

        Map<String, Object> contract = new LinkedHashMap<>();
        contract.put("consumer", "monolith");
        contract.put("provider", "communications");
        contract.put("interactions", Interactions.INTERACTIONS);
        Path folder = Path.of(args[0], "consumer");
        Files.createDirectories(folder);
        Files.writeString(
            folder.resolve("contract.json"),
            Interactions.json(contract) + "\n"
        );
        Files.writeString(
            folder.resolve("report.txt"),
            String.join("\n", report) + "\n"
        );
        int count = Interactions.INTERACTIONS.size();
        System.out.println("consumer: " + count + " interactions in the contract");
    }
}
