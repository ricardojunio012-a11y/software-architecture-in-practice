// The month's charge report, for the management company.
import fs from "node:fs";
import type { Charge } from "./calculation.ts";
import type { BillingPeriod } from "./period.ts";
import { dollars } from "./money.ts";

export class ChargeReport {
  private readonly lines: string[];

  constructor(community: string, period: BillingPeriod) {
    this.lines = [
      `# Charges ${period.label} - ${community} - due ${period.dueDate}`,
      "unit;resident;dues;reserve;arrears;late_fee;interest;total;payment",
    ];
  }

  add(c: Charge, paymentCode: string): void {
    const values = [c.dues, c.reserve, c.arrears, c.lateFee, c.interest, c.total];
    this.lines.push(
      [c.unit.id, c.unit.resident.name, ...values.map(dollars), paymentCode].join(";"),
    );
  }

  save(file: string): void {
    fs.writeFileSync(file, this.lines.join("\n") + "\n");
  }
}
