// The orchestrator with a fake database: compensations in reverse order and the pivot.
import type pg from "pg";
import { describe, expect, it } from "vitest";
import { runSaga, type Step } from "../src/saga.ts";
import { isValidTaxId } from "../src/services.ts";

const fakeDb = () =>
  ({
    async query(sql: string) {
      if (sql.startsWith("SELECT")) return { rows: [{ completed: 0 }] };
      return { rows: [] };
    },
  }) as unknown as pg.Client;

const fast = { attemptsAfterPivot: 5, baseDelayMs: 1 };

describe("saga", () => {
  it("compensates the completed steps in reverse order", async () => {
    const done: string[] = [];
    const step = (name: string, fails = false): Step => ({
      name,
      run: async () => {
        if (fails) throw new Error("error");
        done.push(name);
      },
      compensate: async () => {
        done.push(`undo ${name}`);
      },
    });
    const result = await runSaga(fakeDb(), "s", [
      step("a"),
      step("b"),
      step("c", true),
    ]);
    expect(result).toBe("compensated");
    expect(done).toEqual(["a", "b", "undo b", "undo a"]);
  });

  it("after the pivot, retries instead of compensating", async () => {
    let attempts = 0;
    const result = await runSaga(
      fakeDb(),
      "s",
      [
        { name: "pivot", run: async () => {}, pivot: true },
        {
          name: "after",
          run: async () => {
            if (++attempts < 3) throw new Error("down");
          },
        },
      ],
      undefined,
      fast,
    );
    expect(result).toBe("completed");
    expect(attempts).toBe(3);
  });

  it("after the pivot, halts the saga when the attempts run out", async () => {
    let attempts = 0;
    const result = await runSaga(
      fakeDb(),
      "s",
      [
        { name: "pivot", run: async () => {}, pivot: true },
        {
          name: "after",
          run: async () => {
            attempts++;
            throw new Error("down");
          },
        },
      ],
      undefined,
      fast,
    );
    expect(result).toBe("halted");
    expect(attempts).toBe(5);
  });
});

describe("tax ID", () => {
  it("checks the structure of the number", () => {
    expect(isValidTaxId("529-98-2247")).toBe(true);
    expect(isValidTaxId("529-98-224")).toBe(false);
    expect(isValidTaxId("666-12-3456")).toBe(false);
    expect(isValidTaxId("529-00-2247")).toBe(false);
  });
});
