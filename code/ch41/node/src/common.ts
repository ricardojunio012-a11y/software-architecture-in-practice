// Shared pieces: the lab's simulated clock and the seeded generator.

// The "today" that the legacy, Morada and the proxy see. The lab moves forward one
// day at a time; no date comes from the machine's clock.
export const clock = { today: "2026-11-01" };

export function nextDay(): void {
  const d = new Date(clock.today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  clock.today = d.toISOString().slice(0, 10);
}

// Seeded pseudorandom generator (mulberry32): the same draws on every run
export function generator(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// $1,048.72 from 104872 cents (the format Morada shows)
export function dollars(cents: number): string {
  const s = (Math.abs(cents) / 100).toFixed(2);
  const [int, dec] = s.split(".");
  const thousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (cents < 0 ? "-" : "") + "$" + thousands + "." + dec;
}

// An output that goes to the terminal and to the verified file
export class Output {
  lines: string[] = [];
  write(text = ""): void {
    this.lines.push(text);
    console.log(text);
  }
}
