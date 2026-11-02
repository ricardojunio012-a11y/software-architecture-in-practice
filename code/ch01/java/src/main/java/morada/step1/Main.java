// Usage: java morada.step1.Main <input.json> <output-folder> [--today YYYY-MM-DD]
package morada.step1;

import java.time.LocalDate;

public class Main {

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : null;
        MonthlyBilling.generateBilling(args[0], args[1], today);
        System.out.println("charges generated in " + args[1]);
    }
}
