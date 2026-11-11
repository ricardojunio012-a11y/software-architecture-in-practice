// A simulated clock: sleep(ms) does not really wait; the clock jumps straight to the
// next event. Six seconds of traffic run in a fraction of a second, and the result is
// the same on every run.
export class Clock {
  now = 0;
  #events: { at: number; order: number; wake: () => void }[] = [];
  #order = 0;

  sleep(ms: number): Promise<void> {
    return new Promise((wake) => {
      this.#events.push({ at: this.now + ms, order: this.#order++, wake });
    });
  }

  // Wakes the events in time order until none is left
  async run(): Promise<void> {
    for (;;) {
      // lets the promises already resolved move on before the next event
      await new Promise((r) => setImmediate(r));
      if (this.#events.length === 0) return;
      let i = 0;
      for (let j = 1; j < this.#events.length; j++) {
        const a = this.#events[j];
        const b = this.#events[i];
        if (a.at < b.at || (a.at === b.at && a.order < b.order)) i = j;
      }
      const [next] = this.#events.splice(i, 1);
      this.now = next.at;
      next.wake();
    }
  }
}

// Seeded pseudorandom generator (mulberry32): the same draws on every run
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
