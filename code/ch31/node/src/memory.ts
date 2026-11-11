// In-memory adapters: the same ports, with no cloud at all.
// They serve the core's tests and show that the core does not depend on AWS.
import type {
  Cloud,
  Document,
  Documents,
  Files,
  ReceivedTask,
  Task,
  Tasks,
} from "./ports.ts";

export class InMemoryFiles implements Files {
  private files = new Map<string, Uint8Array>();
  async store(path: string, content: Uint8Array) {
    this.files.set(path, content);
  }
  async read(path: string) {
    return this.files.get(path);
  }
}

// It does not imitate the SQS visibility timeout: a task received and not
// acked stays stuck here. It is a known difference between the adapters
export class InMemoryTasks implements Tasks {
  private queue: ReceivedTask[] = [];
  private inFlight = new Map<string, ReceivedTask>();
  private next = 1;
  async publish(task: Task) {
    this.queue.push({ task, receipt: String(this.next++) });
  }
  async receive(max: number) {
    const batch = this.queue.splice(0, max);
    for (const r of batch) this.inFlight.set(r.receipt, r);
    return batch;
  }
  async ack(received: ReceivedTask) {
    this.inFlight.delete(received.receipt);
  }
}

export class InMemoryDocuments implements Documents {
  private documents = new Map<string, Document>();
  async registerIfNew(document: Document) {
    const key = `${document.community}|${document.month}`;
    if (this.documents.has(key)) return false;
    this.documents.set(key, { ...document });
    return true;
  }
  async forCommunity(community: string) {
    return [...this.documents.values()]
      .filter((d) => d.community === community)
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}

export const inMemoryCloud = (): Cloud => ({
  files: new InMemoryFiles(),
  tasks: new InMemoryTasks(),
  documents: new InMemoryDocuments(),
});
