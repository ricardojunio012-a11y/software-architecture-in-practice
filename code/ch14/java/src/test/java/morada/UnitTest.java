// Unit tests: the service's rule, with no network and no database. They run in
// milliseconds.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import morada.communications.Communications;
import morada.communications.Communications.InMemoryNotices;
import morada.communications.Communications.InvalidDataError;
import org.junit.jupiter.api.Test;

class UnitTest {

    @Test
    void sendsANewNotice() {
        var communications = new Communications(new InMemoryNotices());
        assertEquals("sent", communications.send("E-1", "payment received"));
    }

    @Test
    void recognizesADuplicateNotice() {
        var communications = new Communications(new InMemoryNotices());
        communications.send("E-1", "payment received");
        assertEquals("duplicate", communications.send("E-1", "payment received"));
    }

    @Test
    void rejectsANoticeWithoutText() {
        var communications = new Communications(new InMemoryNotices());
        assertThrows(InvalidDataError.class, () -> communications.send("E-1", ""));
    }
}
