// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
// Composition root: the only place that knows the concrete classes and assembles them.
import fs from "node:fs";
import path from "node:path";
import { dateInMonth, monthLabel } from "../shared/dates.ts";
import { AlphaBankClient } from "../external/alpha-bank.ts";
import { EasyPayApi } from "../external/easy-pay.ts";
import { ChargeCalculator } from "./billing/calculator.ts";
import { BoardPresidentExemption } from "./billing/rules/board-president-exemption.ts";
import { EarlyPaymentDiscount } from "./billing/rules/early-payment-discount.ts";
import { LateFee } from "./billing/rules/late-fee.ts";
import { LateInterest } from "./billing/rules/late-interest.ts";
import { MonthlyDues } from "./billing/rules/monthly-dues.ts";
import { PastDueBalance } from "./billing/rules/past-due-balance.ts";
import { ReserveFund } from "./billing/rules/reserve-fund.ts";
import type { PaymentGateway } from "./issuing/gateway.ts";
import { IssuingService } from "./issuing/issuing-service.ts";
import { AlphaBankGateway } from "./providers/alpha-bank-gateway.ts";
import { EasyPayGateway } from "./providers/easy-pay-gateway.ts";
import { chargeReport, registrationReport } from "./reports.ts";

const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const p = data.policy;
const deadlines = {
  dueDate: dateInMonth(today, p.dueDay),
  discountUntil: dateInMonth(today, p.discountByDay),
};

// Order matters: each rule sees what the previous ones posted
const rules = [
  new MonthlyDues(data.community.monthlyExpensesCents),
  new ReserveFund(p.reserveFundPercent),
  new BoardPresidentExemption(),
  new PastDueBalance(),
  new LateFee(p.lateFeePercent),
  new LateInterest(p.monthlyInterestPercent, today),
  // Last: the discount depends on the exemption and the past-due balance already posted
  new EarlyPaymentDiscount(p.earlyDiscountPercent, deadlines.discountUntil),
];
const gateways: Record<string, () => PaymentGateway> = {
  alpha: () => new AlphaBankGateway(new AlphaBankClient()),
  easypay: () => new EasyPayGateway(new EasyPayApi()),
};
const gateway = gateways[process.env.GATEWAY ?? "alpha"]();
const service = new IssuingService(new ChargeCalculator(rules), gateway, deadlines);

const { charges, registrations } = service.issue(data.units);
const title = `${monthLabel(today)} - ${data.community.name}`;
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  path.join(output, "charges.txt"),
  chargeReport(title, charges, deadlines),
);
fs.writeFileSync(
  path.join(output, "registrations.txt"),
  registrationReport(title, gateway.name, charges, registrations),
);
console.log(`charges issued in ${output} (${gateway.name})`);
