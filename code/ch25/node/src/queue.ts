// The task queue on PostgreSQL. Claiming a task is an atomic update: SKIP LOCKED makes
// each worker skip the rows another one is already claiming, and a task claimed longer
// ago than the visibility timeout goes back to the queue.
import type pg from "pg";

export interface Task {
  id: number;
  kind: string;
  community_id: number;
  attempts: number;
}

const VISIBILITY_TIMEOUT = "2 seconds";

export async function claim(db: pg.Client): Promise<Task | null> {
  const { rows } = await db.query(
    `UPDATE tasks SET status = 'running', claimed_at = now(),
            attempts = attempts + 1
     WHERE id = (
       SELECT id FROM tasks
       WHERE status = 'pending'
          OR (status = 'running' AND claimed_at < now() - $1::interval)
       ORDER BY priority, id
       FOR UPDATE SKIP LOCKED
       LIMIT 1)
     RETURNING id, kind, community_id, attempts`,
    [VISIBILITY_TIMEOUT],
  );
  return rows[0] ?? null;
}

// Creates the invoices and marks the task as done in the same transaction: either both
// happen or neither does, and a retry duplicates nothing. The attempt number is the
// ownership token: if the timeout expired and another worker claimed the task, the
// attempt changed, the update finds no row, and the transaction is rolled back.
// Returns whether it completed the task.
export async function complete(db: pg.Client, task: Task, period: string) {
  await db.query("BEGIN");
  try {
    const marked = await db.query(
      `UPDATE tasks SET status = 'done', finished_at = clock_timestamp()
       WHERE id = $1 AND status = 'running' AND attempts = $2`,
      [task.id, task.attempts],
    );
    if (marked.rowCount === 0) {
      await db.query("ROLLBACK");
      return false;
    }
    await db.query(
      `INSERT INTO invoices
       SELECT id, generate_series(1, units), $2 FROM communities WHERE id = $1
       ON CONFLICT DO NOTHING`,
      [task.community_id, period],
    );
    await db.query("COMMIT");
    return true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
