// Dates come in as parameters: no hidden clock.
export function daysBetween(isoDate: string, today: Date): number {
  return Math.round((today.getTime() - Date.parse(isoDate + "T00:00:00Z")) / 86400000);
}

export function monthLabel(today: Date): string {
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${today.getUTCFullYear()}`;
}
