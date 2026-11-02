// The billing period of the charge and the dates that depend on it.
export interface BillingPeriod {
  today: Date;
  label: string; // "03/2026"
  code: string; // "202603"
  dueDate: string; // "03/10/2026"
  discountDeadline: string; // "03/05/2026"
}

export function periodOf(today: Date): BillingPeriod {
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  return {
    today,
    label: `${month}/${year}`,
    code: `${year}${month}`,
    dueDate: `${month}/10/${year}`,
    discountDeadline: `${month}/05/${year}`,
  };
}

// Calendar days between a date (YYYY-MM-DD) and today
export function daysSince(isoDate: string, today: Date): number {
  const start = Date.parse(isoDate + "T00:00:00Z");
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((end - start) / 86400000);
}
