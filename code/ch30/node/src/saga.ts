// A minimal saga orchestrator. It runs the steps in order and saves its progress in the
// database after each one; if a step fails before the pivot, it runs the compensations
// of the completed steps, in reverse order. After the pivot, there is no way back: the
// remaining steps are retried with a growing delay, up to a limit; once the limit is
// reached, the saga halts and waits for a person. On resume, the orchestrator continues
// from the saved state: if it crashed while compensating, it keeps compensating.
import type pg from "pg";

export interface Step {
  name: string;
  run: () => Promise<void>;
  compensate?: (reason: string) => Promise<void>;
  pivot?: boolean; // the step that cannot be undone
}

export interface Options {
  attemptsAfterPivot: number;
  baseDelayMs: number;
}

// Used in the lab to simulate the orchestrator crashing
export class Crash extends Error {}

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// crashAt simulates the crash: "charge" crashes after running that step;
// "compensation:provisioning", after compensating it; in both cases, before saving
// the progress
export async function runSaga(
  db: pg.Client,
  id: string,
  steps: Step[],
  crashAt?: string,
  options: Options = { attemptsAfterPivot: 5, baseDelayMs: 100 },
): Promise<string> {
  const record = (message: string) =>
    db.query("INSERT INTO orchestrator.history (saga, message) VALUES ($1, $2)", [
      id,
      message,
    ]);
  const setStatus = (status: string, reason?: string) =>
    db.query(
      "UPDATE orchestrator.sagas SET status = $2, " +
        "reason = coalesce($3, reason) WHERE id = $1",
      [id, status, reason ?? null],
    );
  await db.query(
    "INSERT INTO orchestrator.sagas (id, status) VALUES ($1, 'running') " +
      "ON CONFLICT (id) DO NOTHING",
    [id],
  );
  const { rows } = await db.query("SELECT * FROM orchestrator.sagas WHERE id = $1", [
    id,
  ]);
  const saved = rows[0];
  let completed: number = saved.completed;

  // The compensations of the completed steps, in reverse order. They are idempotent:
  // after a crash, redoing one that had already been done changes nothing
  const compensate = async (reason: string) => {
    await setStatus("compensating", reason);
    for (let j = completed - 1; j >= 0; j--) {
      const undo = steps[j].compensate;
      if (!undo) continue;
      await undo(reason);
      if (crashAt === `compensation:${steps[j].name}`)
        throw new Crash(`crash while compensating ${steps[j].name}`);
      await record(`compensated: ${steps[j].name}`);
    }
    await setStatus("compensated");
    return "compensated";
  };

  // Resuming follows the saved state, not just the number of completed steps
  if (saved.status === "completed" || saved.status === "compensated")
    return saved.status;
  if (saved.status === "compensating") {
    await record("resumed during compensation");
    return compensate(saved.reason);
  }
  if (completed > 0) await record(`resumed after ${completed} step(s)`);

  const pivot = steps.findIndex((s) => s.pivot);
  for (let i = completed; i < steps.length; i++) {
    const step = steps[i];
    for (let attempt = 1; ; attempt++) {
      try {
        await step.run();
        if (step.name === crashAt) throw new Crash(`crash after ${step.name}`);
        break;
      } catch (error) {
        if (error instanceof Crash) throw error; // the progress was not saved
        const reason = (error as Error).message;
        if (pivot < 0 || i <= pivot) {
          await record(`${step.name} failed: ${reason}`);
          return compensate(reason);
        }
        // After the pivot, there is no way back: retry, waiting longer each time
        if (attempt >= options.attemptsAfterPivot) {
          await record(`${step.name} ran out of attempts; saga halted`);
          await setStatus("halted", reason);
          return "halted";
        }
        await record(`${step.name} failed after the pivot; retrying`);
        await sleep(options.baseDelayMs * 2 ** (attempt - 1));
      }
    }
    completed = i + 1;
    await db.query("UPDATE orchestrator.sagas SET completed = $2 WHERE id = $1", [
      id,
      completed,
    ]);
    await record(`completed: ${step.name}`);
  }
  await setStatus("completed");
  return "completed";
}
