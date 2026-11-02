// End-to-end test: the monolith's client, the real API and PostgreSQL together.
// Few, slow and valuable: they prove the pieces were wired correctly.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import morada.communications.Api;
import morada.communications.Communications;
import morada.communications.PostgresNotices;
import morada.monolith.CommunicationsClient;
import morada.monolith.CommunicationsClient.Result;
import org.junit.jupiter.api.Test;

class EndToEndTest {

    @Test
    void sendsTheNoticeOnceAndRecognizesTheResend() throws Exception {
        assumeTrue(System.getenv("DATABASE_URL") != null, "no database");
        try (var notices = PostgresNotices.connect(System.getenv("DATABASE_URL"))) {
            var api = Api.create(new Communications(notices));
            var client = new CommunicationsClient(Api.start(api));
            assertEquals(
                new Result(true, false, null),
                client.send("E-1", "payment received")
            );
            assertEquals(
                new Result(true, true, null),
                client.send("E-1", "payment received")
            );
            api.stop(0);
        }
    }
}
