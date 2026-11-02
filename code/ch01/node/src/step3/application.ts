// Orchestrates the monthly run: calculates, creates the payment, records and notifies.
import { calculateCharge, type Unit } from "./calculation.ts";
import { periodOf } from "./period.ts";
import type { Notifier } from "./notification.ts";
import type { PaymentMethod } from "./payment.ts";
import { ChargeReport } from "./report.ts";

export interface CommunityData {
  community: { id: string; name: string; monthlyExpensesCents: number };
  units: Unit[];
}

export function generateBilling(
  data: CommunityData,
  today: Date,
  payment: PaymentMethod,
  notifier: Notifier,
): ChargeReport {
  const { community } = data;
  const period = periodOf(today);
  const report = new ChargeReport(community.name, period);
  for (const unit of data.units) {
    const charge = calculateCharge(community.monthlyExpensesCents, unit, today);
    const code = payment.generateCode(community.id, period, charge);
    report.add(charge, code);
    notifier.notify({
      community: community.name,
      period,
      charge,
      payment: { name: payment.name, code },
    });
  }
  return report;
}
