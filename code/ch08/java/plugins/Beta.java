// Beta Bank plugin: another number format, same contract.
import morada.plugins.BankPlugin;

public class Beta implements BankPlugin {

    private int last = 0;

    public String name() {
        return "beta";
    }

    public String register(Charge charge) {
        last++;
        return String.format("BETA/%04d", last);
    }
}
