// The Communications service from chapter 12, now with a notice repository: the
// same notice requested twice is sent only once.
package morada.communications;

import java.util.HashMap;
import java.util.Map;

public class Communications {

    public static class InvalidDataError extends RuntimeException {

        public InvalidDataError(String message) {
            super(message);
        }
    }

    public interface NoticeRepository {
        boolean alreadySent(String id);

        void record(String id, String text);
    }

    public static class InMemoryNotices implements NoticeRepository {

        private final Map<String, String> notices = new HashMap<>();

        public boolean alreadySent(String id) {
            return notices.containsKey(id);
        }

        public void record(String id, String text) {
            notices.put(id, text);
        }
    }

    private final NoticeRepository notices;

    public Communications(NoticeRepository notices) {
        this.notices = notices;
    }

    public String send(String id, String text) {
        if (text == null || text.isEmpty()) {
            throw new InvalidDataError("text is required");
        }
        if (notices.alreadySent(id)) return "duplicate";
        notices.record(id, text);
        return "sent";
    }
}
