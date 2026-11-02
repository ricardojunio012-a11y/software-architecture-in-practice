// Executable quality scenarios: they generate a synthetic load, measure what is ours,
// estimate what depends on third parties and compare the total with the target.
import { calculateCharge, type Unit } from "./billing/calculation.ts";
import { periodOf } from "./billing/period.ts";
import { formatEmail } from "./billing/notification.ts";
import { Invoice } from "./billing/payment.ts";

export interface Scenario {
  id: string;
  description: string;
  communities: number;
  unitsPerCommunity: number;
  invoicesPerSecond: number; // how many invoices the payment processor creates
  limitSeconds: number;
}

export interface Result {
  scenario: Scenario;
  charges: number;
  calculationSeconds: number; // measured
  processorSeconds: number; // estimated
  noticeBytes: number;
  passed: boolean;
}

// Synthetic, deterministic community: the same load in every language
export function syntheticCommunity(i: number, units: number) {
  const list: Unit[] = [];
  for (let k = 1; k <= units; k++) {
    list.push({
      id: `U-${k}`,
      shareMillionths: Math.floor(1000000 / units),
      resident: {
        name: `Resident ${k}`,
        email: `resident${k}@example.com`,
        channel: "email",
      },
      paymentMethod: "invoice",
      pastDue: k % 7 === 0 ? { amountCents: 50000, dueDate: "2026-02-10" } : null,
    });
  }
  const expenses = 3000000 + (i % 50) * 10000;
  return {
    community: {
      id: `community-${i}`,
      name: `Community ${i}`,
      monthlyExpensesCents: expenses,
    },
    units: list,
  };
}

// The scenario's response measure: finish within the limit
export function evaluate(seconds: number, limitSeconds: number): boolean {
  return seconds <= limitSeconds;
}

export function run(scenario: Scenario, today: Date): Result {
  const invoice = new Invoice();
  const period = periodOf(today);
  let charges = 0;
  let noticeBytes = 0;
  const start = performance.now();
  for (let i = 1; i <= scenario.communities; i++) {
    const { community, units } = syntheticCommunity(i, scenario.unitsPerCommunity);
    for (const unit of units) {
      const charge = calculateCharge(community.monthlyExpensesCents, unit, today);
      const code = invoice.generateCode(community.id, period, charge);
      const payment = { name: invoice.name, code };
      const notice = formatEmail({
        community: community.name,
        period,
        charge,
        payment,
      });
      noticeBytes += Buffer.byteLength(notice);
      charges++;
    }
  }
  const calculationSeconds = (performance.now() - start) / 1000;
  // Creating the invoices depends on the payment processor: estimated from its capacity
  const processorSeconds = charges / scenario.invoicesPerSecond;
  const total = calculationSeconds + processorSeconds;
  return {
    scenario,
    charges,
    calculationSeconds,
    processorSeconds,
    noticeBytes,
    passed: evaluate(total, scenario.limitSeconds),
  };
}
