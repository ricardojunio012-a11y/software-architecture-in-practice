// Domain events: facts that have already happened, in the vocabulary of the business.
import type { Money } from "./money.ts";
import type { TimeSlot } from "./time-slot.ts";

export interface BookingConfirmed {
  readonly type: "BookingConfirmed";
  readonly booking: string;
  readonly space: string;
  readonly slot: TimeSlot;
  readonly unit: string;
  readonly fee: Money;
}

export interface BookingCanceled {
  readonly type: "BookingCanceled";
  readonly booking: string;
  readonly cancellationFee: Money;
}

export type DomainEvent = BookingConfirmed | BookingCanceled;
