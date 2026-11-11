// SLI, error budget, and burn rate alerts, over per-minute counts.

// Requests and errors of each minute, with running sums to read any window
export class Series {
  #requests: number[] = [0];
  #errors: number[] = [0];

  add(requests: number, errors: number): void {
    this.#requests.push(this.#requests.at(-1)! + requests);
    this.#errors.push(this.#errors.at(-1)! + errors);
  }

  get minutes(): number {
    return this.#requests.length - 1;
  }

  // Minutes (end - size, end]; at the start of the series, the window is what exists
  window(end: number, size: number): { requests: number; errors: number } {
    const from = Math.max(0, end - size);
    return {
      requests: this.#requests[end] - this.#requests[from],
      errors: this.#errors[end] - this.#errors[from],
    };
  }
}

// Burn rate: the fraction of errors divided by the fraction the SLO allows.
// 1 spends the budget exactly at the end of the period; 14.4 spends 2% of it in 1 h.
export function burnRate(errors: number, requests: number, slo: number): number {
  return requests === 0 ? 0 : errors / requests / (1 - slo);
}

export interface Rule {
  name: string;
  long: number; // minutes
  short: number;
  rate: number;
}

// The three rules the SRE Workbook recommends for a 30-day period
export const RULES: Rule[] = [
  { name: "page, 1 h and 5 min, 14.4x", long: 60, short: 5, rate: 14.4 },
  { name: "page, 6 h and 30 min, 6x", long: 360, short: 30, rate: 6 },
  { name: "ticket, 3 d and 6 h, 1x", long: 4320, short: 360, rate: 1 },
];

export interface Episode {
  start: number; // minute when the alert fired
  end: number; // minute when it stopped firing
}

// The rule fires when both windows cross the threshold: the long one ensures the
// spending matters, the short one ensures it is still happening now
export function firing(s: Series, r: Rule, slo: number, minute: number): boolean {
  const long = s.window(minute, r.long);
  const short = s.window(minute, r.short);
  return (
    burnRate(long.errors, long.requests, slo) >= r.rate &&
    burnRate(short.errors, short.requests, slo) >= r.rate
  );
}

// Evaluates a condition every minute and returns the notifications: an alert that fires
// again less than 30 minutes after it stopped is still the same notification
export function episodes(
  s: Series,
  condition: (minute: number) => boolean,
  tolerance = 30,
): Episode[] {
  const r: Episode[] = [];
  let open: Episode | undefined;
  for (let m = 1; m <= s.minutes; m++) {
    const now = condition(m);
    const last = r.at(-1);
    if (now && !open) {
      if (last && m - last.end < tolerance) open = last;
      else r.push((open = { start: m, end: s.minutes }));
    }
    if (!now && open) {
      open.end = m;
      open = undefined;
    }
    if (now && open) open.end = s.minutes;
  }
  return r;
}
