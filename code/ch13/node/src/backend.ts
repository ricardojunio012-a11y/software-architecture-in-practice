// The Morada back end (the monolith): Front Desk handles packages and visitors;
// Bookings knows who the guests of each party are. Neither one knows about screens.
export interface Package {
  id: string;
  unit: string;
  status: "at front desk" | "delivered" | "returned";
  version: number;
  by?: string;
  time?: string;
}

export interface Visitor {
  name: string;
  booking: string;
  tablet: string;
  time: string;
}

export interface Guest {
  name: string;
  booking: string;
  space: string;
}

export class FrontDesk {
  readonly packages = new Map<string, Package>();
  readonly visitors: Visitor[] = [];

  constructor(packages: { id: string; unit: string }[]) {
    for (const p of packages) {
      this.packages.set(p.id, { ...p, status: "at front desk", version: 1 });
    }
  }

  // Optimistic concurrency: changes only if nobody changed it since the seen version
  change(
    id: string,
    status: "delivered" | "returned",
    seenVersion: number,
    tablet: string,
    time: string,
  ): string {
    const p = this.packages.get(id)!;
    if (p.version !== seenVersion) {
      return `conflict: ${id} already ${p.status} by tablet ${p.by} at ${p.time}`;
    }
    Object.assign(p, { status, version: p.version + 1, by: tablet, time });
    return "applied";
  }

  registerVisitor(name: string, booking: string, tablet: string, time: string) {
    this.visitors.push({ name, booking, tablet, time });
    return "applied";
  }
}

export class Bookings {
  readonly #guests: Guest[] = [];

  constructor(parties: { booking: string; space: string; names: string[] }[]) {
    for (const p of parties) {
      for (const name of p.names) {
        this.#guests.push({ name, booking: p.booking, space: p.space });
      }
    }
  }

  guests(): Guest[] {
    return [...this.#guests];
  }
}
