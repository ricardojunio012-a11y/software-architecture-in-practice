// Alpha Bank plugin: numbers the invoices in sequence, with five digits.
import morada.plugins.BankPlugin;

public class Alpha implements BankPlugin {

    private int last = 0;

    public String name() {
        return "alpha";
    }

    public String register(Charge charge) {
        last++;
        return String.format("ALPHA-%05d", last);
    }
}
