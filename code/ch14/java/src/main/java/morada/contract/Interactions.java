// The interactions the consumer (the monolith) expects from the provider
// (Communications). Each one gives the state the provider must be in, the request
// and the response.
package morada.contract;

import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.core.util.Separators;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Interactions {

    private Interactions() {}

    public record Request(String method, String path, Map<String, String> body) {}

    public record Response(int status, Map<String, String> body) {}

    public record Interaction(
        String description,
        String state,
        Request request,
        Response response
    ) {}

    static Map<String, String> map(String... pairs) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) m.put(pairs[i], pairs[i + 1]);
        return m;
    }

    static final Request NOTICE = new Request(
        "POST",
        "/notices",
        map("id", "E-P-001", "text", "payment received")
    );

    public static final List<Interaction> INTERACTIONS = List.of(
        new Interaction(
            "sending a new notice",
            "no notice has been sent",
            NOTICE,
            new Response(200, map("notice", "E-P-001", "status", "sent"))
        ),
        new Interaction(
            "resending a notice already sent",
            "notice E-P-001 has already been sent",
            NOTICE,
            new Response(200, map("notice", "E-P-001", "status", "duplicate"))
        ),
        new Interaction(
            "notice without text",
            "no notice has been sent",
            new Request("POST", "/notices", map("id", "E-P-002", "text", "")),
            new Response(400, map("error", "text is required"))
        )
    );

    // JSON with a two-space indent and "key": value, the same as in the other languages
    public static String json(Object data) throws Exception {
        var indent = new DefaultIndenter("  ", "\n");
        var printer = new DefaultPrettyPrinter().withSeparators(
            Separators.createDefaultInstance().withObjectFieldValueSpacing(
                Separators.Spacing.AFTER
            )
        );
        printer.indentObjectsWith(indent);
        printer.indentArraysWith(indent);
        return new ObjectMapper().writer(printer).writeValueAsString(data);
    }
}
