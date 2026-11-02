// Controller (GRASP): coordinates the calculation and the registration without doing
// either. Depends on abstractions passed to the constructor (dependency injection).
import type { ChargeCalculator } from "../billing/calculator.ts";
import type { Charge } from "../billing/charge.ts";
import type { Unit } from "../billing/types.ts";
import type { Deadlines, PaymentGateway, Registration } from "./gateway.ts";

export class IssuingService {
  readonly #calculator: ChargeCalculator;
  readonly #gateway: PaymentGateway;
  readonly #deadlines: Deadlines;

  constructor(
    calculator: ChargeCalculator,
    gateway: PaymentGateway,
    deadlines: Deadlines,
  ) {
    this.#calculator = calculator;
    this.#gateway = gateway;
    this.#deadlines = deadlines;
  }

  issue(units: readonly Unit[]): {
    charges: Charge[];
    registrations: Registration[];
  } {
    const charges = units.map((u) => this.#calculator.calculate(u));
    const registrations = charges.map((c) =>
      this.#gateway.register(c, this.#deadlines),
    );
    return { charges, registrations };
  }
}
