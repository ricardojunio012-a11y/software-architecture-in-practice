// The Backend for Frontend of the front-desk staff app. It belongs to the app team and
// speaks the language of the screen: it gathers in one call what the tablet needs and
// receives the operations made offline, in a batch, applying each one only once.
import type { Bookings, FrontDesk, Guest } from "./backend.ts";

export interface Operation {
  id: string;
  type: "deliver" | "return" | "registerVisitor";
  time: string;
  packageId?: string;
  seenVersion?: number;
  name?: string;
  booking?: string;
}

export class StaffBff {
  readonly #frontDesk: FrontDesk;
  readonly #bookings: Bookings;
  readonly #results: Map<string, string>;
  repeated = 0;

  // Without the third argument, the results live only in this process's memory
  constructor(frontDesk: FrontDesk, bookings: Bookings, results = new Map()) {
    this.#frontDesk = frontDesk;
    this.#bookings = bookings;
    this.#results = results;
  }

  // The whole home screen in one call, with only the fields the tablet shows
  home() {
    const pendingPackages = [...this.#frontDesk.packages.values()]
      .filter((p) => p.status === "at front desk")
      .map(({ id, unit, version }) => ({ id, unit, version }));
    // Compares name and booking field by field: "Anna" must not match "Mary Anna"
    const entered = (g: Guest) =>
      this.#frontDesk.visitors.some(
        (v) => v.name === g.name && v.booking === g.booking,
      );
    const expectedVisitors = this.#bookings.guests().filter((g) => !entered(g));
    return { pendingPackages, expectedVisitors };
  }

  // Idempotent by operation id: a resent batch applies nothing twice
  sync(tablet: string, operations: Operation[]): [Operation, string][] {
    return operations.map((op) => {
      const previous = this.#results.get(op.id);
      if (previous) {
        this.repeated += 1;
        return [op, previous];
      }
      const result =
        op.type === "registerVisitor"
          ? this.#frontDesk.registerVisitor(op.name!, op.booking!, tablet, op.time)
          : this.#frontDesk.change(
              op.packageId!,
              op.type === "deliver" ? "delivered" : "returned",
              op.seenVersion!,
              tablet,
              op.time,
            );
      this.#results.set(op.id, result);
      return [op, result];
    });
  }
}
