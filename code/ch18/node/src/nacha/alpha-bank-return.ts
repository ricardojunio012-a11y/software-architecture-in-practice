// Anticorruption layer for Alpha Bank's return file. The file has 80-character lines,
// in a simplified fixed-width layout inspired by Nacha ACH files. Everything that
// belongs to the bank (positions, status codes, MMDDYYYY dates, amounts with no
// decimal point, the payment reference) stays here; the rest of Morada only sees
// PaymentReceived.
import type { PaymentReceived } from "../billing.ts";

// Positions start at 1, as in the bank's manual
const DETAIL = {
  type: [4, 4],
  status: [5, 6],
  reference: [7, 26],
  date: [27, 34],
  amount: [35, 49],
  fee: [50, 64],
} as const;
const TRAILER = { count: [5, 10], total: [11, 25] } as const;

const SETTLED = "06";
const STATUS_CODES: Record<string, string> = {
  "02": "invoice accepted",
  "06": "settled",
  "09": "canceled",
};

const field = (line: string, [start, end]: readonly [number, number]) =>
  line.slice(start - 1, end).trim();

// "11042026" -> "2026-11-04"
const date = (mmddyyyy: string) =>
  `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`;

// Morada generates the payment reference as "MORADA" + the charge code
const chargeCode = (reference: string) => reference.replace(/^MORADA0*/, "");

export interface Translation {
  payments: PaymentReceived[];
  ignored: string[];
}

export function translateReturn(text: string): Translation {
  const lines = text.split("\n").filter((l) => l.trim());
  const details = lines.filter((l) => field(l, DETAIL.type) === "3");
  const trailer = lines.find((l) => field(l, DETAIL.type) === "9");
  if (!trailer) throw new Error("return file with no trailer: incomplete file");

  const payments: PaymentReceived[] = [];
  const ignored: string[] = [];
  for (const line of details) {
    const status = field(line, DETAIL.status);
    const charge = chargeCode(field(line, DETAIL.reference));
    if (status !== SETTLED) {
      ignored.push(`${charge}: ${STATUS_CODES[status] ?? `status ${status}`}`);
      continue;
    }
    payments.push({
      charge,
      paidOn: date(field(line, DETAIL.date)),
      amountPaidCents: Number(field(line, DETAIL.amount)),
      feeCents: Number(field(line, DETAIL.fee)),
    });
  }

  // The trailer checks the file: a return file cut in half must not become payments
  const count = Number(field(trailer, TRAILER.count));
  const total = Number(field(trailer, TRAILER.total));
  const sum = payments.reduce((s, p) => s + p.amountPaidCents, 0);
  if (count !== details.length || total !== sum) {
    throw new Error(
      `trailer does not match: ${count} records and ${total} cents declared, ` +
        `${details.length} records and ${sum} cents read`,
    );
  }
  return { payments, ignored };
}
