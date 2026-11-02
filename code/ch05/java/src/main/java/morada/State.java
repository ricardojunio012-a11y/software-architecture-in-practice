// State: what you can do with a booking depends on the state it is in.
// Each state is an object that knows which transitions it accepts; the booking
// only passes the call on.
package morada;

import morada.Types.BookingRequest;

public abstract class State {

    public abstract String name();

    // By default, no transition is allowed; each state allows its own
    void approve(Booking booking) {
        rejectTransition("approve");
    }

    void reject(Booking booking) {
        rejectTransition("reject");
    }

    void cancel(Booking booking) {
        rejectTransition("cancel");
    }

    private void rejectTransition(String action) {
        throw new IllegalStateException(
            "cannot " + action + " a " + name() + " booking"
        );
    }

    static final class Pending extends State {

        public String name() {
            return "pending";
        }

        @Override
        void approve(Booking booking) {
            booking.changeTo(APPROVED);
        }

        @Override
        void reject(Booking booking) {
            booking.changeTo(REJECTED);
        }

        @Override
        void cancel(Booking booking) {
            booking.changeTo(CANCELED);
        }
    }

    static final class Approved extends State {

        public String name() {
            return "approved";
        }

        @Override
        void cancel(Booking booking) {
            booking.changeTo(CANCELED);
        }
    }

    static final class Rejected extends State {

        public String name() {
            return "rejected";
        }
    }

    static final class Canceled extends State {

        public String name() {
            return "canceled";
        }
    }

    // The states hold no data of their own: one instance of each is enough
    static final State APPROVED = new Approved();
    static final State REJECTED = new Rejected();
    static final State CANCELED = new Canceled();

    public static final class Booking {

        private final BookingRequest request;
        private State state = new Pending();

        public Booking(BookingRequest request) {
            this.request = request;
        }

        public BookingRequest request() {
            return request;
        }

        public String state() {
            return state.name();
        }

        public void approve() {
            state.approve(this);
        }

        public void reject() {
            state.reject(this);
        }

        public void cancel() {
            state.cancel(this);
        }

        // Used only by the states
        void changeTo(State next) {
            state = next;
        }
    }
}
