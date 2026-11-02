// Everything in one function: the rules in chained ifs and Alpha Bank called in the
// middle of the calculation. A new rule or another bank means changing this function.
import {
  dateInMonth,
  daysBetween,
  monthDay,
  monthLabel,
  usDate,
} from "../shared/dates.ts";
import { dollars, percentOf, plainDollars, shareOf } from "../shared/money.ts";
import { AlphaBankClient } from "../external/alpha-bank.ts";

const line = (text: string, amount: number) =>
  "  " + text.padEnd(40) + dollars(amount).padStart(10);

export function issueCharges(data: any, today: Date) {
  const p = data.policy;
  const dueDate = dateInMonth(today, p.dueDay);
  const discountUntil = dateInMonth(today, p.discountByDay);
  const title = `${monthLabel(today)} - ${data.community.name}`;
  const bank = new AlphaBankClient();
  const charges = [`# Charges ${title}`];
  const registrations = [`# Registrations ${title} - Alpha Bank`];
  registrations.push("unit;identifier;amount;discount");

  for (const u of data.units) {
    const items: [string, number][] = [];
    const dues = shareOf(data.community.monthlyExpensesCents, u.shareMillionths);
    items.push(["Monthly dues", dues]);
    const reserve = percentOf(dues, p.reserveFundPercent);
    items.push([`Reserve fund (${p.reserveFundPercent}%)`, reserve]);
    if (u.boardPresident) items.push(["Board president exemption", -dues]);
    const d = u.pastDue;
    if (d) {
      const days = daysBetween(d.dueDate, today);
      const interest = Math.floor(
        (d.amountCents * p.monthlyInterestPercent * days + 1500) / 3000,
      );
      items.push([`Past-due balance (due ${monthDay(d.dueDate)})`, d.amountCents]);
      items.push([
        `Late fee (${p.lateFeePercent}%)`,
        percentOf(d.amountCents, p.lateFeePercent),
      ]);
      items.push([`Interest (${days} days)`, interest]);
    }
    const total = items.reduce((sum, [, amount]) => sum + amount, 0);
    // No discount for the board president or for units in arrears (chapter 1 rule)
    const pd = p.earlyDiscountPercent;
    const discount = u.boardPresident || d ? 0 : percentOf(dues, pd);

    charges.push(
      "",
      `${u.id} ${u.resident.name}`,
      ...items.map(([t, a]) => line(t, a)),
    );
    const by = monthDay(discountUntil);
    if (discount > 0) {
      charges.push(line(`Discount by ${by} (${p.earlyDiscountPercent}%)`, -discount));
    }
    charges.push(line("Total", total));
    if (discount > 0)
      charges.push(line(`Total with discount by ${by}`, total - discount));

    // The calculation knows the bank: changing banks means changing this function
    const invoice = bank.createInvoice({
      payer: u.resident.name,
      amount: plainDollars(total),
      dueDate: usDate(dueDate),
      ...(discount > 0 && {
        discount: { amount: plainDollars(discount), until: usDate(discountUntil) },
      }),
    });
    registrations.push(
      `${u.id};invoice ${invoice.invoiceNumber};${dollars(total)};${dollars(discount)}`,
    );
  }
  return {
    charges: charges.join("\n") + "\n",
    registrations: registrations.join("\n") + "\n",
  };
}
