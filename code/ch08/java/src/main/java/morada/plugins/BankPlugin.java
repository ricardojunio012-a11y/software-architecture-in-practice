// The contract: everything the core knows about a plugin.
package morada.plugins;

public interface BankPlugin {
    record Charge(String unit, long amountCents, String bank) {}

    String name();

    String register(Charge charge);
}
