// Private data of Bookings: one space, one booking per day (simplified).
export class Schedule {
  readonly #spaces: Set<string>;
  readonly #occupancy = new Map<string, string>();

  constructor(spaces: string[]) {
    this.#spaces = new Set(spaces);
  }

  occupant(space: string, date: string): string | undefined {
    if (!this.#spaces.has(space)) throw new Error(`space ${space} does not exist`);
    return this.#occupancy.get(`${space} ${date}`);
  }

  record(booking: string, space: string, date: string) {
    this.#occupancy.set(`${space} ${date}`, booking);
  }
}
