// Dates in ISO format (YYYY-MM-DD) and "today" received as a parameter.
export function daysBetween(isoDate: string, today: Date): number {
  return Math.round((today.getTime() - Date.parse(isoDate + "T00:00:00Z")) / 86400000);
}

export function dateInMonth(today: Date, day: number): string {
  return today.toISOString().slice(0, 8) + String(day).padStart(2, "0");
}

export function monthLabel(today: Date): string {
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${today.getUTCFullYear()}`;
}

// 2026-03-10 -> 03/10
export function monthDay(isoDate: string): string {
  return `${isoDate.slice(5, 7)}/${isoDate.slice(8, 10)}`;
}

// 2026-03-10 -> 03/10/2026
export function usDate(isoDate: string): string {
  return `${monthDay(isoDate)}/${isoDate.slice(0, 4)}`;
}
