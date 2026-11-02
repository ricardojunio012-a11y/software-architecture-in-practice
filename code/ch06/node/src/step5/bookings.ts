// Bookings module. Step 5: separate phases (Split Phase) and no global state.
// decide() calculates; report() and notices() format; main reads and writes.
export interface Space {
  id: string;
  name: string;
  fee: number;
}

export interface Unit {
  id: string;
  email: string;
  inArrears: boolean;
}

export interface Request {
  id: string;
  unit: string;
  space: string;
  date: string;
  guests: number;
}

export interface Decision {
  request: Request;
  email: string;
  reason: string | null;
  amount: number;
}

const MIN_NOTICE_DAYS = 2;
const SATURDAY_SURCHARGE_PERCENT = 20;
const GUEST_LIMIT = 50;
const EXTRA_CLEANING_FEE = 5000; // cents

export function daysUntil(isoDate: string, today: Date): number {
  const startOfToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((Date.parse(isoDate + "T00:00:00Z") - startOfToday) / 86400000);
}

// The original comment said "weekend", but the code only checks Saturday
export function isSaturday(isoDate: string): boolean {
  return new Date(isoDate + "T00:00:00Z").getUTCDay() === 6;
}

export function bookingAmount(space: Space, request: Request): number {
  let amount = space.fee;
  if (isSaturday(request.date)) amount += (amount * SATURDAY_SURCHARGE_PERCENT) / 100;
  if (request.guests > GUEST_LIMIT) amount += EXTRA_CLEANING_FEE;
  return amount;
}

export function declineReason(
  request: Request,
  unit: Unit,
  today: Date,
  approved: readonly Request[],
): string | null {
  if (unit.inArrears) return "arrears";
  if (daysUntil(request.date, today) < MIN_NOTICE_DAYS) return "short notice";
  const taken = approved.some(
    (b) => b.space === request.space && b.date === request.date,
  );
  return taken ? "conflict" : null;
}

// Phase 1: decide each request, in order. The approved list is now local.
export function decide(
  data: { spaces: Space[]; units: Unit[]; requests: Request[] },
  today: Date,
): Decision[] {
  const approved: Request[] = [];
  return data.requests.map((request) => {
    const unit = data.units.find((u) => u.id === request.unit)!;
    const space = data.spaces.find((s) => s.id === request.space)!;
    const reason = declineReason(request, unit, today, approved);
    if (reason) return { request, email: unit.email, reason, amount: 0 };
    approved.push(request);
    return {
      request,
      email: unit.email,
      reason,
      amount: bookingAmount(space, request),
    };
  });
}

export function dollars(cents: number): string {
  return Math.floor(cents / 100) + "." + String(cents % 100).padStart(2, "0");
}

// Phase 2: format the report and the notices from the decisions
export function report(decisions: readonly Decision[]): string[] {
  return decisions.map(({ request: r, reason, amount }) => {
    const head = `${r.id};${r.unit};${r.space};${r.date}`;
    return reason
      ? `${head};declined;${reason}`
      : `${head};approved;${dollars(amount)}`;
  });
}

export function notices(
  decisions: readonly Decision[],
): { to: string; text: string }[] {
  return decisions.map(({ request, email, reason, amount }) => ({
    to: email,
    text: reason
      ? `Booking ${request.id} declined (${reason})`
      : `Booking ${request.id} confirmed. Amount: $${dollars(amount)}`,
  }));
}
