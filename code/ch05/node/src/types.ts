// The booking data and small date and money functions.
export interface Space {
  id: string;
  name: string;
  feeCents: number;
  minNoticeDays: number;
  monthlyLimit: number;
}

export interface Resident {
  name: string;
  email: string;
  phone?: string;
  device?: string;
  channel: string;
}

export interface Unit {
  id: string;
  inArrears: boolean;
  resident: Resident;
}

export interface BookingRequest {
  id: string;
  unit: Unit;
  space: Space;
  date: string;
}

export interface Decision {
  approved: boolean;
  reason?: string;
}

export function daysBetween(today: Date, isoDate: string): number {
  return Math.round((Date.parse(isoDate + "T00:00:00Z") - today.getTime()) / 86400000);
}

// 2026-03-14 -> 03/14/2026
export function usDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
}

// 15000 -> 150.00 (US format)
export function dollars(c: number): string {
  const whole = Math.floor(c / 100).toLocaleString("en-US");
  return whole + "." + String(c % 100).padStart(2, "0");
}
