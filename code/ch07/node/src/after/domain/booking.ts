// Entity: it has an identity (the id) and a life cycle. It changes only through its
// own methods.
import type { Money } from "./money.ts";
import { DomainError } from "./error.ts";
import type { TimeSlot } from "./time-slot.ts";

export class Booking {
  readonly id: string;
  readonly unit: string;
  readonly slot: TimeSlot;
  readonly fee: Money;
  #status: "confirmed" | "canceled" = "confirmed";

  constructor(id: string, unit: string, slot: TimeSlot, fee: Money) {
    this.id = id;
    this.unit = unit;
    this.slot = slot;
    this.fee = fee;
  }

  get isActive(): boolean {
    return this.#status === "confirmed";
  }

  cancel(): void {
    if (!this.isActive) throw new DomainError("booking is not confirmed");
    this.#status = "canceled";
  }
}
