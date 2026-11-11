// The assistant's guards (guardrails). Prompt injection arrives hidden in the
// documents themselves: a text that tries to give orders to the model. The defense
// here is to take those chunks out of the context; in production, it adds to a
// classifier and to the principle of never giving the model a power the user lacks.
const INJECTION = [
  /ignore (the|all|all the) (previous )?instructions/i,
  /disregard (the|your) (prompt|instruc)/i,
  /you are now/i,
  /reveal (the|your) (prompt|instruc)/i,
];

export const looksLikeInjection = (text: string) => INJECTION.some((r) => r.test(text));

// Daily token budget per community: one community's cost does not become everyone's
export class Budget {
  readonly #limit: Map<number, number>;
  readonly #spent = new Map<number, number>();

  constructor(limitPerCommunity: Record<string, number>) {
    this.#limit = new Map(
      Object.entries(limitPerCommunity).map(([c, n]) => [Number(c), n]),
    );
  }

  fits(community: number, estimate: number): boolean {
    const spent = this.#spent.get(community) ?? 0;
    return spent + estimate <= (this.#limit.get(community) ?? 0);
  }

  spend(community: number, tokens: number) {
    this.#spent.set(community, (this.#spent.get(community) ?? 0) + tokens);
  }

  spent(community: number) {
    return this.#spent.get(community) ?? 0;
  }
}
