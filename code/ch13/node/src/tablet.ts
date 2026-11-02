// The front-desk staff app, on the tablet. Offline, it keeps the operations in a local
// queue and keeps working; on reconnect, it sends the queue to the BFF and shows the
// conflicts.
import type { Operation, StaffBff } from "./bff.ts";

export class Tablet {
  readonly #name: string;
  readonly #connect: () => StaffBff;
  readonly #log: string[];
  readonly #versions = new Map<string, number>();
  readonly #queue: Operation[] = [];
  #online = true;
  #counter = 0;

  constructor(name: string, connect: () => StaffBff, log: string[]) {
    this.#name = name;
    this.#connect = connect;
    this.#log = log;
  }

  // The tablet talks to the BFF's address, whatever process is serving it
  get #bff() {
    return this.#connect();
  }

  #note(text: string) {
    this.#log.push(`tablet ${this.#name} ${text}`);
  }

  open() {
    const screen = this.#bff.home();
    for (const p of screen.pendingPackages) this.#versions.set(p.id, p.version);
    const pending = screen.pendingPackages.map((p) => p.id).join(", ");
    const expected = screen.expectedVisitors.map((v) => v.name).join(", ");
    this.#note(`opened: packages [${pending}], expected visitors [${expected}]`);
  }

  disconnect() {
    this.#online = false;
    this.#note("lost the internet");
  }

  operate(op: Omit<Operation, "id" | "seenVersion">) {
    this.#counter += 1;
    const full: Operation = { ...op, id: `op-${this.#name}${this.#counter}` };
    if (op.packageId) full.seenVersion = this.#versions.get(op.packageId);
    if (!this.#online) {
      this.#queue.push(full);
      this.#note(`stored ${this.#describe(full)} in the local queue`);
      return;
    }
    const [[, result]] = this.#bff.sync(this.#name, [full]);
    this.#note(`sent ${this.#describe(full)}: ${result}`);
  }

  // On reconnect, the queue goes as a batch, and the response may be lost on the way
  reconnect(loseResponse: boolean) {
    this.#online = true;
    const results = this.#bff.sync(this.#name, this.#queue);
    if (loseResponse) {
      const n = this.#queue.length;
      this.#note(`came back and sent ${n} operations; the response was lost`);
      return;
    }
    this.#show("sent", results);
  }

  // Without a response, the tablet does not know what was applied: it resends the batch
  resend() {
    this.#show("resent", this.#bff.sync(this.#name, this.#queue));
  }

  #show(verb: string, results: [Operation, string][]) {
    this.#note(`${verb} ${this.#queue.length} operations:`);
    for (const [op, result] of results) {
      this.#log.push(`  ${this.#describe(op)}: ${result}`);
    }
    this.#queue.length = 0;
  }

  #describe(op: Operation) {
    const target = op.packageId ?? op.name;
    return `${op.id} (${op.type} ${target})`;
  }
}
