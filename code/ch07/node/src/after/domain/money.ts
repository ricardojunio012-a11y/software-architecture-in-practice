// Value object: immutable, compared by value, and owner of its own rules.
import { DomainError } from "./error.ts";

export class Money {
  readonly cents: number;

  private constructor(cents: number) {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new DomainError("a money amount must be a whole number of cents");
    }
    this.cents = cents;
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static readonly ZERO = new Money(0);

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  // Percentage rounded half up, always in the same place
  percent(percent: number): Money {
    return new Money(Math.floor((this.cents * percent + 50) / 100));
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  // $1,234.56
  toString(): string {
    const whole = String(Math.floor(this.cents / 100)).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ",",
    );
    return `$${whole}.${String(this.cents % 100).padStart(2, "0")}`;
  }
}
