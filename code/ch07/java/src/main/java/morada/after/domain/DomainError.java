// A business rule was broken; the message is for the resident.
package morada.after.domain;

public class DomainError extends RuntimeException {

    public DomainError(String message) {
        super(message);
    }
}
