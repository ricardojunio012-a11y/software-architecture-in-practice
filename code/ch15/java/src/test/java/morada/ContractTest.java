// Contract tests. The first one is the test that breaks the build when someone
// changes openapi/v1.yaml in a way that current clients cannot handle. When the image
// is built, the contracts are not mounted, so the tests are skipped.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import morada.api.Api;
import morada.contract.Compatibility;
import morada.contract.OpenApi;
import morada.contract.Validate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ContractTest {

    @BeforeEach
    void needsTheContracts() {
        assumeTrue(Files.exists(Path.of("/data/openapi/v1.yaml")), "no contracts");
    }

    static List<String> breaks(JsonNode old, JsonNode proposed) {
        return Compatibility.compare(old, proposed)
            .stream()
            .filter(c -> !c.compatible())
            .map(Compatibility.Change::text)
            .toList();
    }

    @Test
    void theCurrentContractIsCompatibleWithThePublishedOne() throws Exception {
        JsonNode published = OpenApi.read("/data/openapi/published/v1.yaml");
        JsonNode current = OpenApi.read("/data/openapi/v1.yaml");
        assertEquals(List.of(), breaks(published, current));
    }

    @Test
    void renamingAResponseFieldIsIncompatible() throws Exception {
        JsonNode published = OpenApi.read("/data/openapi/published/v1.yaml");
        JsonNode proposal = OpenApi.read("/data/input/proposals/b-rename.yaml");
        String expected =
            "GET /v1/communities/{community}/charges 200: " +
            "field removed: data[].amountCents";
        assertEquals(List.of(expected), breaks(published, proposal));
    }

    @Test
    void aResponseWithTheWrongTypeFailsTheCheck() throws Exception {
        JsonNode body = Api.JSON.readTree(
            """
            {"data": [{"id": "CH-02", "unit": "102", "dueDate": "2026-10-10",
              "amountCents": "450.00", "status": "open"}], "next": null}"""
        );
        JsonNode current = OpenApi.read("/data/openapi/v1.yaml");
        String path = "/v1/communities/C-01/charges";
        String expected =
            "GET /v1/communities/{community}/charges 200: " +
            "$.data[0].amountCents: expected integer, got string";
        String type = "application/json";
        assertEquals(
            List.of(expected),
            Validate.validateResponse(current, "GET", path, 200, type, body)
        );
    }
}
