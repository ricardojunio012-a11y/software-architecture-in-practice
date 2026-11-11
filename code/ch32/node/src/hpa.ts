// The HorizontalPodAutoscaler calculation, as the Kubernetes docs describe it:
//   desired = ceil(current × current metric value / desired metric value)
// with the 10% tolerance, the replicas that are not ready yet counted as 0% when
// the calculation asks to scale up, the stabilization window when scaling down, and
// the default scale-up policies (the larger of doubling and adding 4 every 15 s).
export const TOLERANCE = 0.1;

export type Measurement = {
  current: number; // replicas that exist (spec.replicas)
  readyUsage: number[]; // % of the CPU request, one per ready replica
  notReady: number; // replicas created that are not ready yet
};

// The recommendation of one cycle, before the limits and the stabilization
export function recommend(m: Measurement, target: number): number {
  const ready = m.readyUsage.length;
  if (ready === 0) return m.current; // no metrics, no decision
  const mean = m.readyUsage.reduce((a, b) => a + b, 0) / ready;
  let ratio = mean / target;
  if (Math.abs(ratio - 1) <= TOLERANCE) return m.current;
  let base = ready;
  if (ratio > 1 && m.notReady > 0) {
    // conservative: the ones still starting enter the mean at 0%
    base = ready + m.notReady;
    const adjusted = (mean * ready) / base / target;
    // if the correction reverses the direction or falls within tolerance, no change
    if (adjusted <= 1 || Math.abs(adjusted - 1) <= TOLERANCE) return m.current;
    ratio = adjusted;
  }
  return Math.ceil(ratio * base);
}

export type Hpa = {
  min: number;
  max: number;
  target: number;
  scaleDownWindow: number;
};

// The controller: keeps the recent recommendations to stabilize scaling down
export class HpaController {
  #history: { t: number; value: number }[] = [];
  readonly cfg: Hpa;
  constructor(cfg: Hpa) {
    this.cfg = cfg;
  }

  // t in seconds; returns the new number of replicas. The minimum can change with
  // the time of day, as in the day-5 pre-scaling
  cycle(t: number, m: Measurement, min = this.cfg.min): number {
    const rec = recommend(m, this.cfg.target);
    this.#history.push({ t, value: rec });
    this.#history = this.#history.filter((h) => h.t > t - this.cfg.scaleDownWindow);
    let desired = rec;
    if (rec < m.current) {
      // scale down only to the largest recommendation in the window
      desired = Math.min(m.current, Math.max(...this.#history.map((h) => h.value)));
    } else if (rec > m.current) {
      // default scale-up policies: 100% or 4 replicas per period, the larger
      desired = Math.min(rec, Math.max(m.current * 2, m.current + 4));
    }
    return Math.max(min, Math.min(this.cfg.max, desired));
  }
}
