// New notification channel: added without touching the email.
import fs from "node:fs";
import { dollars } from "./money.ts";
import type { Notice, Notifier } from "./notification.ts";

export function formatSms({ community, period, charge, payment }: Notice): string {
  const { unit } = charge;
  let text =
    `${community}: dues ${period.label} for unit ${unit.id}: ` +
    `$${dollars(charge.total)}, due ${period.dueDate}.`;
  if (charge.totalBy5th !== null) {
    text += ` By ${period.discountDeadline}: $${dollars(charge.totalBy5th)}.`;
  }
  text += ` ${payment.name}: ${payment.code}`;
  return `To: ${unit.resident.phone}\n${text}\n----\n`;
}

// Simulates sending by writing the messages to a file
export class SmsToFile implements Notifier {
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
    fs.writeFileSync(file, "");
  }

  notify(notice: Notice): void {
    fs.appendFileSync(this.file, formatSms(notice));
  }
}
