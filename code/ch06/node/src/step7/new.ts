// The new code: the refactored module from step 5 plus the limit rule, which was
// already born separate in step 6 (the sprout class) and so migrates without a rewrite.
import { MonthlyLimit } from "../step6/limit.ts";
import {
  type Decision,
  type Request,
  type Space,
  type Unit,
  bookingAmount,
  declineReason,
} from "../step5/bookings.ts";

export function decide(
  data: { spaces: Space[]; units: Unit[]; requests: Request[] },
  today: Date,
  limit = new MonthlyLimit(),
): Decision[] {
  const approved: Request[] = [];
  return data.requests.map((request) => {
    const unit = data.units.find((u) => u.id === request.unit)!;
    const space = data.spaces.find((s) => s.id === request.space)!;
    const reason =
      declineReason(request, unit, today, approved) ??
      (limit.reached(request, approved) ? "monthly booking limit reached" : null);
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
