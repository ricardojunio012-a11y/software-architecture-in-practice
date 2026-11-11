// The front-desk device: it records each gate entry in a local queue and removes it
// only when the broker confirms receipt (MQTT QoS 1). With no network, the entries wait
// in the queue; when the network comes back, they go out in the order they happened.
// The queue lives in a SQLite file, so it survives a device restart; with ":memory:",
// it dies with the process, which the lab uses for comparison.
import { DatabaseSync } from "node:sqlite";
import type { MqttClient } from "mqtt";

export interface Entry {
  id: string; // unique per device: it is what lets the server ignore duplicates
  plate: string;
  time: string;
}

export class LocalQueue {
  readonly #db: DatabaseSync;

  constructor(file = ":memory:") {
    this.#db = new DatabaseSync(file);
    this.#db.exec(
      "CREATE TABLE IF NOT EXISTS pending " +
        "(seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL)",
    );
  }

  // The write finishes before record returns: the entry is already on disk
  record(entry: Entry) {
    this.#db
      .prepare("INSERT INTO pending (entry) VALUES (?)")
      .run(JSON.stringify(entry));
  }

  get size() {
    const row = this.#db.prepare("SELECT count(*) AS n FROM pending").get();
    return Number(row!.n);
  }

  // Sends one at a time, in order, and removes only what the broker confirmed
  async drain(client: MqttClient, topic: string) {
    const first = this.#db.prepare(
      "SELECT seq, entry FROM pending ORDER BY seq LIMIT 1",
    );
    const remove = this.#db.prepare("DELETE FROM pending WHERE seq = ?");
    for (let p = first.get(); p && client.connected; p = first.get()) {
      await client.publishAsync(topic, String(p.entry), { qos: 1 });
      remove.run(p.seq);
    }
  }

  close() {
    this.#db.close();
  }
}

// On the server side: keeps the identifiers already received and ignores duplicates
export class Receiver {
  readonly received: Entry[] = [];
  readonly #seen = new Set<string>();
  duplicates = 0;

  receive(entry: Entry) {
    if (this.#seen.has(entry.id)) {
      this.duplicates++;
      return;
    }
    this.#seen.add(entry.id);
    this.received.push(entry);
  }
}
