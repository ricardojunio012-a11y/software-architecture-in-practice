// Communications subscribes to the same event and notifies the resident. It does not
// know Bookings: everything it needs came inside the event.
package morada.modules;

import static morada.Events.dollars;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import morada.Events.PaymentConfirmed;

public class Communications {

    private final Set<String> processed = new HashSet<>();
    public final List<String> notices = new ArrayList<>();
    public final List<String> log = new ArrayList<>();

    public void onPaymentConfirmed(PaymentConfirmed e) {
        if (!processed.add(e.event())) {
            log.add("communications ignored " + e.event() + " (duplicate)");
            return;
        }
        String payment =
            "payment " + e.payment() + " of " + dollars(e.amountCents()) + " received";
        notices.add(
            e.unit() + ": " + payment + "; booking " + e.booking() + " confirmed"
        );
        log.add("communications received " + e.event() + ": notified " + e.unit());
    }
}
