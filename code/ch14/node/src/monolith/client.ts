// The client the monolith uses to talk to the Communications service: the
// consumer of the contract. It interprets the responses the service promises.
export type Result = { ok: true; duplicate: boolean } | { ok: false; error: string };

export class CommunicationsClient {
  readonly #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  async send(id: string, text: string): Promise<Result> {
    const response = await fetch(`${this.#url}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    });
    const body = await response.json();
    if (response.status === 200)
      return { ok: true, duplicate: body.status === "duplicate" };
    return { ok: false, error: body.error };
  }
}
