// Everything in one method: the rules one if after another and Alpha Bank called in
// the middle of the calculation. A new rule or another bank means changing this method.
package morada.before;

import static morada.shared.Dates.*;
import static morada.shared.Money.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import morada.external.AlphaBankClient;

public class Issuing {

    record Item(String text, long amount) {}

    static String line(String text, long amount) {
        return String.format("  %-40s%10s", text, dollars(amount));
    }

    public static String[] issueCharges(JsonNode data, LocalDate today) {
        JsonNode p = data.get("policy");
        String dueDate = dateInMonth(today, p.get("dueDay").asInt());
        String discountUntil = dateInMonth(today, p.get("discountByDay").asInt());
        String title =
            monthLabel(today) + " - " + data.get("community").get("name").asText();
        var bank = new AlphaBankClient();
        List<String> charges = new ArrayList<>(List.of("# Charges " + title));
        List<String> registrations = new ArrayList<>();
        registrations.add("# Registrations " + title + " - Alpha Bank");
        registrations.add("unit;identifier;amount;discount");

        for (JsonNode u : data.get("units")) {
            List<Item> items = new ArrayList<>();
            long expenses = data.get("community").get("monthlyExpensesCents").asLong();
            long dues = shareOf(expenses, u.get("shareMillionths").asLong());
            items.add(new Item("Monthly dues", dues));
            int pr = p.get("reserveFundPercent").asInt();
            items.add(new Item("Reserve fund (" + pr + "%)", percentOf(dues, pr)));
            boolean president = u.path("boardPresident").asBoolean(false);
            if (president) items.add(new Item("Board president exemption", -dues));
            JsonNode d = u.get("pastDue");
            if (!d.isNull()) {
                long a = d.get("amountCents").asLong();
                String due = d.get("dueDate").asText();
                long days = daysBetween(due, today);
                long interest =
                    (a * p.get("monthlyInterestPercent").asInt() * days + 1500) / 3000;
                int pf = p.get("lateFeePercent").asInt();
                items.add(new Item("Past-due balance (due " + monthDay(due) + ")", a));
                items.add(new Item("Late fee (" + pf + "%)", percentOf(a, pf)));
                items.add(new Item("Interest (" + days + " days)", interest));
            }
            long total = items.stream().mapToLong(Item::amount).sum();
            int pd = p.get("earlyDiscountPercent").asInt();
            // No discount for the board president or for units in arrears (chapter 1 rule)
            long discount = president || !d.isNull() ? 0 : percentOf(dues, pd);

            charges.add("");
            charges.add(
                u.get("id").asText() + " " + u.get("resident").get("name").asText()
            );
            for (Item i : items) charges.add(line(i.text(), i.amount()));
            String by = monthDay(discountUntil);
            if (discount > 0) {
                charges.add(line("Discount by " + by + " (" + pd + "%)", -discount));
            }
            charges.add(line("Total", total));
            if (discount > 0) {
                long withDiscount = total - discount;
                charges.add(line("Total with discount by " + by, withDiscount));
            }

            // The calculation knows the bank: changing banks means changing this method
            var invoice = bank.createInvoice(
                new AlphaBankClient.InvoiceRequest(
                    u.get("resident").get("name").asText(),
                    plainDollars(total),
                    usDate(dueDate),
                    discount > 0
                        ? new AlphaBankClient.Discount(
                              plainDollars(discount),
                              usDate(discountUntil)
                          )
                        : null
                )
            );
            String identifier = "invoice " + invoice.invoiceNumber();
            String amounts = dollars(total) + ";" + dollars(discount);
            registrations.add(u.get("id").asText() + ";" + identifier + ";" + amounts);
        }
        return new String[] {
            String.join("\n", charges) + "\n",
            String.join("\n", registrations) + "\n",
        };
    }
}
