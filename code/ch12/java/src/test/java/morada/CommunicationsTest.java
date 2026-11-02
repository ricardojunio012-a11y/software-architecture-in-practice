// Tests: the Communications module is the same inside and outside the monolith.
package morada;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CommunicationsTest {

    @Test
    void sendsEachNoticeOnlyOnceEvenWhenAskedAgain() {
        var communications = new Communications();
        assertTrue(communications.send("E-P-001", "payment received"));
        assertFalse(communications.send("E-P-001", "payment received"));
        assertTrue(communications.send("E-P-002", "payment received"));
    }
}
