// How the resident learns about the charge.
package morada.billing;

public interface Notifier {
    void notify(Notice notice);
}
