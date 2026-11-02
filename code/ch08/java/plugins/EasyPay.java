// EasyPay plugin: creates a card payment identified by the unit.
import morada.plugins.BankPlugin;

public class EasyPay implements BankPlugin {

    public String name() {
        return "easypay";
    }

    public String register(Charge charge) {
        return "CARD-" + charge.unit().replace("-", "");
    }
}
