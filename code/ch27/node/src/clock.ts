// Lamport's logical clock: a counter that each process increments on every event and
// that, on receiving a message, jumps past the sender's clock. It does not tell what
// time it is; it tells that, if one event caused another, the first has the smaller
// number.
export class LamportClock {
  #value = 0;

  // A local event, including sending a message: returns the event's timestamp
  tick(): number {
    return ++this.#value;
  }

  // On receiving a message with the sender's timestamp
  receive(stamp: number): number {
    this.#value = Math.max(this.#value, stamp) + 1;
    return this.#value;
  }
}
