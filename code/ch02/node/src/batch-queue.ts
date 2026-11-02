// Simulation of the batch invoice queue at the payment processor ("now the hard part").
// Simulated clock and a fixed-seed random draw: the same output on any machine.
// The numbers in batch.json are lab assumptions, not those of a real processor.

export interface Assumptions {
  id: string;
  description: string;
  invoices: number;
  invoicesPerFile: number;
  invoicesPerSecond: number; // processor throughput while it processes a batch file
  returnSeconds: number; // the return file for each batch arrives this much later
  transientFailurePercent: number; // a rejection that may succeed on a new attempt
  permanentRejectionEvery: number; // 1 in N invoices has bad data (e.g., tax ID)
  maxAttempts: number;
  limitSeconds: number;
  seed: number;
}

export interface Result {
  files: number;
  attempts: number;
  availableAt: Map<number, number>; // simulation second -> how many invoices
  notCreated: number; // never became available
  viaCard: number; // got card payment instead of the invoice
}

// Park-Miller congruential generator: integers only, the same in all four languages
function generator(seed: number) {
  let x = seed;
  return () => (x = (x * 48271) % 2147483647);
}

interface BatchFile {
  sentAt: number;
  order: number;
  invoices: number[];
  attempt: number;
}

// naive: resends every rejection and notifies the resident only with a created invoice.
// adjusted: a permanent rejection does not go back to the queue, and an invoice with no
// time left to be confirmed switches to card payment (the ADR-002 alternative).
export function simulate(p: Assumptions, adjusted: boolean): Result {
  const draw = generator(p.seed);
  const queue: BatchFile[] = [];
  for (let i = 0; i < p.invoices; i += p.invoicesPerFile) {
    const end = Math.min(p.invoices, i + p.invoicesPerFile);
    const invoices = Array.from({ length: end - i }, (_, k) => i + k);
    queue.push({ sentAt: 0, order: queue.length, invoices, attempt: 1 });
  }
  const r: Result = {
    files: 0,
    attempts: 0,
    availableAt: new Map(),
    notCreated: 0,
    viaCard: 0,
  };
  const available = (t: number) =>
    r.availableAt.set(t, (r.availableAt.get(t) ?? 0) + 1);
  let order = queue.length;
  let processorFree = 0;
  while (queue.length > 0) {
    // The processor handles one file at a time, in order of arrival
    let i = 0;
    for (let k = 1; k < queue.length; k++) {
      const a = queue[k],
        b = queue[i];
      if (a.sentAt < b.sentAt || (a.sentAt === b.sentAt && a.order < b.order)) i = k;
    }
    const batch = queue.splice(i, 1)[0];
    r.files++;
    r.attempts += batch.invoices.length;
    const n = batch.invoices.length;
    const start = Math.max(batch.sentAt, processorFree);
    processorFree = start + Math.ceil(n / p.invoicesPerSecond);
    const returnAt = processorFree + p.returnSeconds;
    const resend: number[] = [];
    for (const inv of batch.invoices) {
      const permanent = inv % p.permanentRejectionEvery === 0;
      const rejected = permanent || draw() % 100 < p.transientFailurePercent;
      if (!rejected) {
        available(returnAt);
      } else if (!adjusted) {
        if (batch.attempt < p.maxAttempts) resend.push(inv);
        else r.notCreated++;
      } else if (
        permanent ||
        batch.attempt >= p.maxAttempts ||
        returnAt + p.returnSeconds > p.limitSeconds
      ) {
        available(returnAt); // the notice goes out with card payment, no new cycle
        r.viaCard++;
      } else {
        resend.push(inv);
      }
    }
    if (resend.length > 0) {
      const attempt = batch.attempt + 1;
      queue.push({ sentAt: returnAt, order: order++, invoices: resend, attempt });
    }
  }
  return r;
}

// Nearest-rank percentile, in thousandths (990 = p99, 999 = p99.9).
// Returns null when it falls on the invoices that never became available.
export function percentile(r: Result, total: number, thousandths: number) {
  const rank = Math.ceil((thousandths * total) / 1000);
  let cumulative = 0;
  for (const t of [...r.availableAt.keys()].sort((a, b) => a - b)) {
    cumulative += r.availableAt.get(t)!;
    if (cumulative >= rank) return t;
  }
  return null;
}

export function availableBy(r: Result, limit: number): number {
  let sum = 0;
  for (const [t, n] of r.availableAt) if (t <= limit) sum += n;
  return sum;
}
