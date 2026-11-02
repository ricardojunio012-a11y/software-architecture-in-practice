// The Communications module: sends notices to the residents. It is idempotent on
// the notice id: the same notice requested twice is sent only once.
package morada;

import java.util.HashSet;
import java.util.Set;

public class Communications {

    private final Set<String> sent = new HashSet<>();

    // Returns true if it sent the notice now and false if it had already been sent
    public boolean send(String id, String text) {
        return sent.add(id);
    }
}
