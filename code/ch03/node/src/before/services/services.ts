// Billing services: calculates the charges and builds the outputs.
import { config } from "../config/config.ts";
import { generateReport } from "../reports/reports.ts";
import { daysLate, dollars, period } from "../util/util.ts";

// Internal list, but exported: anyone can read and change it
export const charges: any[] = [];

export function lateInterest(amount: number, dueDate: string): number {
  return Math.floor((amount * daysLate(dueDate) + 1500) / 3000);
}

export function calculateAll(): void {
  const expenses = config.data.community.monthlyExpensesCents;
  for (const u of config.data.units) {
    const dues = Math.floor((expenses * u.shareMillionths + 500000) / 1000000);
    const reserve = Math.floor((dues * config.reservePercent + 50) / 100);
    const p = u.pastDue;
    const arrears = p ? p.amountCents : 0;
    const lateFee = p ? Math.floor((arrears * config.lateFeePercent + 50) / 100) : 0;
    const interest = p ? lateInterest(arrears, p.dueDate) : 0;
    const total = dues + reserve + arrears + lateFee + interest;
    charges.push({ unit: u, dues, reserve, arrears, lateFee, interest, total });
  }
}

// A parameter decides what the function does (control coupling)
export function generateOutput(type: string): string {
  if (type !== "charges") return generateReport(type);
  const lines = [`# Charges ${period()} - ${config.data.community.name}`];
  lines.push("unit;resident;dues;reserve;arrears;late_fee;interest;total");
  for (const c of charges) {
    const amounts = [c.dues, c.reserve, c.arrears, c.lateFee, c.interest, c.total];
    lines.push([c.unit.id, c.unit.resident.name, ...amounts.map(dollars)].join(";"));
  }
  return lines.join("\n") + "\n";
}
