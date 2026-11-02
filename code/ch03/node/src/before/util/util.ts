// Assorted utilities: whatever did not fit anywhere else (coincidental cohesion).
import { config } from "../config/config.ts";

export function dollars(c: number): string {
  return (
    Math.floor(c / 100).toLocaleString("en-US") + "." + String(c % 100).padStart(2, "0")
  );
}

// Depends, without saying so, on the date kept in the global configuration
export function daysLate(dueDate: string): number {
  return Math.round(
    (config.today.getTime() - Date.parse(dueDate + "T00:00:00Z")) / 86400000,
  );
}

export function period(): string {
  const month = String(config.today.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${config.today.getUTCFullYear()}`;
}
