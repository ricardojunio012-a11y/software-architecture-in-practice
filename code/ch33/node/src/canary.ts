// The canary: the new version serves a slice of the amount-due requests, and the
// version in production serves the rest. Both run the commit's real code; only the
// traffic is simulated, with a fixed seed.
import { generator } from "./random.ts";

export type Charge = { amount: number; dueDate: string };
export type Module = { amountDue(c: Charge, paymentDate: string): unknown };
export type Request = { charge: Charge; day: string };
export type Count = { requests: number; errors: number; message?: string };

const day = (base: string, plus: number) =>
  new Date(Date.parse(base) + plus * 86_400_000).toISOString().slice(0, 10);

// One day of production requests: dues for November and December 2026 and, in 3% of
// them, installments of payment plans for units in arrears, due in early 2027
export function traffic(howMany: number, seed: number): Request[] {
  const draw = generator(seed);
  const requests: Request[] = [];
  for (let i = 0; i < howMany; i++) {
    const amount = 30_000 + Math.floor(draw() * 90_000);
    const plan = draw() < 0.03;
    const month = plan ? 1 + Math.floor(draw() * 6) : 11 + Math.floor(draw() * 2);
    const year = plan ? 2027 : 2026;
    const dueDate = `${year}-${String(month).padStart(2, "0")}-05`;
    requests.push({ charge: { amount, dueDate }, day: day("2026-10-27", i % 30) });
  }
  return requests;
}

async function serve(module: Module, request: Request, count: Count) {
  count.requests++;
  try {
    await module.amountDue(request.charge, request.day);
  } catch (error) {
    count.errors++;
    count.message ??= (error as Error).message;
  }
}

// Rejects the new version if its error rate exceeds production's by more than
// 0.5 percentage points
export async function canary(next: Module, current: Module, requests: Request[]) {
  const slice = generator(33);
  const canary: Count = { requests: 0, errors: 0 };
  const production: Count = { requests: 0, errors: 0 };
  for (const request of requests) {
    if (slice() < 0.05) await serve(next, request, canary);
    else await serve(current, request, production);
  }
  const rate = (c: Count) => (c.requests ? c.errors / c.requests : 0);
  const approved = rate(canary) - rate(production) <= 0.005;
  return { canary, production, approved };
}
