// Observer: whoever publishes an event does not know who reacts to it.
import type { BookingRequest } from "./types.ts";

export interface Event {
  type: "BookingConfirmed" | "BookingRejected";
  request: BookingRequest;
  reason?: string;
}

export interface Subscriber {
  readonly name: string;
  handle(event: Event): void;
}

export class EventBus {
  readonly #subscribers = new Map<string, Subscriber[]>();
  readonly failures: string[] = [];

  subscribe(type: Event["type"], subscriber: Subscriber): void {
    this.#subscribers.set(type, [...(this.#subscribers.get(type) ?? []), subscriber]);
  }

  // A subscriber that fails does not stop the others from receiving the event
  publish(event: Event): void {
    for (const subscriber of this.#subscribers.get(event.type) ?? []) {
      try {
        subscriber.handle(event);
      } catch (error) {
        const id = event.request.id;
        this.failures.push(
          `${event.type} ${id}: ${subscriber.name}: ${errorText(error)}`,
        );
      }
    }
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
