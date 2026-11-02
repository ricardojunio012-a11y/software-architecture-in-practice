// The abstraction belongs to Morada, not to the providers: issuing is what says what
// it needs. Each provider gets an adapter that implements this interface.
import type { Charge } from "../billing/charge.ts";

export interface Deadlines {
  readonly dueDate: string;
  readonly discountUntil: string;
}

export interface Registration {
  readonly unit: string;
  readonly identifier: string;
}

export interface PaymentGateway {
  readonly name: string;
  register(charge: Charge, deadlines: Deadlines): Registration;
}
