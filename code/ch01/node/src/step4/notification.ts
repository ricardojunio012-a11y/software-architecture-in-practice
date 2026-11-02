// How the resident learns about the charge.
import fs from "node:fs";
import type { Charge } from "./calculation.ts";
import type { BillingPeriod } from "./period.ts";
import { dollars } from "./money.ts";

export interface Notice {
  community: string;
  period: BillingPeriod;
  charge: Charge;
  payment: { name: string; code: string };
}

export interface Notifier {
  notify(notice: Notice): void;
}

export function formatEmail({ community, period, charge, payment }: Notice): string {
  const { unit } = charge;
  const lines = [
    `To: ${unit.resident.email}`,
    `Subject: Monthly dues ${period.label} - ${community} - ` + `Unit ${unit.id}`,
    "",
    `Hello, ${unit.resident.name}.`,
    "",
    `The monthly dues for ${period.label} for unit ${unit.id} ` + "are now available.",
    `Amount: $${dollars(charge.total)}`,
    `Due date: ${period.dueDate}`,
  ];
  if (charge.totalBy5th !== null) {
    lines.push(
      `Pay by ${period.discountDeadline} and the amount drops to ` +
        `$${dollars(charge.totalBy5th)}.`,
    );
  }
  if (charge.arrears > 0) {
    lines.push(
      `Includes a past-due balance of $${dollars(charge.arrears)}, with a late ` +
        `fee of $${dollars(charge.lateFee)} and interest of ` +
        `$${dollars(charge.interest)}.`,
    );
  }
  lines.push(`${payment.name}: ${payment.code}`, "", `${community} Management`, "----");
  return lines.join("\n") + "\n";
}

// Simulates sending by writing the messages to a file
export class EmailToFile implements Notifier {
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
    fs.writeFileSync(file, "");
  }

  notify(notice: Notice): void {
    fs.appendFileSync(this.file, formatEmail(notice));
  }
}
