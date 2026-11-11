// The payment processor that creates the invoices, simulated: it accepts at most 8
// calls at the same time and rejects the ones beyond that, like an API with a
// concurrency limit.
export class Rejected extends Error {}

export class PaymentProcessor {
  readonly limit: number;
  inFlight = 0;
  rejections = 0;
  calls = 0;

  constructor(limit: number) {
    this.limit = limit;
  }

  async createInvoice(): Promise<void> {
    if (this.inFlight >= this.limit) {
      this.rejections++;
      throw new Rejected("concurrent call limit");
    }
    this.inFlight++;
    this.calls++;
    try {
      await new Promise((ok) => setTimeout(ok, 5));
    } finally {
      this.inFlight--;
    }
  }
}

// Backpressure on the caller's side: a semaphore that lets at most N calls through at
// the same time and makes the others wait their turn instead of being rejected
export class Semaphore {
  #available: number;
  readonly #queue: (() => void)[] = [];

  constructor(n: number) {
    this.#available = n;
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#available === 0) await new Promise<void>((ok) => this.#queue.push(ok));
    else this.#available--;
    try {
      return await fn();
    } finally {
      const next = this.#queue.shift();
      if (next) next();
      else this.#available++;
    }
  }
}
