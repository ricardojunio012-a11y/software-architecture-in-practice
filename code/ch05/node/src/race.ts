// "Now the hard part": two requests for the same space and the same date
// arrive at the same time. The interleaving is forced, so the output is always
// the same: both go through the chain before either one saves.
import type { Stage } from "./approval.ts";
import type { BookingRepository } from "./repository.ts";
import { Booking } from "./state.ts";
import { usDate, type BookingRequest } from "./types.ts";

type Build = () => { chain: Stage; bookings: BookingRepository };

export function race(requests: BookingRequest[], build: Build): string[] {
  const { space, date } = requests[0];
  const lines = [`Simultaneous requests: ${space.name} on ${usDate(date)}`];
  for (const guarded of [false, true]) {
    lines.push(
      guarded
        ? "save only if the space is free, in a single operation:"
        : "check, then save (check-then-act):",
    );
    const { chain, bookings } = build();
    // 1. Both check: the space is free for both
    const approved = requests.filter((r) => {
      const d = chain.evaluate(r);
      lines.push(
        `  ${r.id} ${r.unit.id}: ${d.approved ? "passed the chain" : d.reason}`,
      );
      return d.approved;
    });
    // 2. Both save
    for (const r of approved) {
      const booking = new Booking(r);
      const saved = guarded ? bookings.saveIfFree(booking) : true;
      if (!guarded) bookings.save(booking);
      if (saved) booking.approve();
      lines.push(`  ${r.id} ${saved ? "saved" : "rejected on save"}`);
    }
    const n = requests.filter((r) => bookings.find(r.id)?.state === "approved");
    const result =
      n.length === 1 ? "1 booking approved" : `${n.length} bookings approved`;
    lines.push(`  result: ${result}${n.length > 1 ? " (double booking)" : ""}`);
  }
  return lines;
}
