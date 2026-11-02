// Strategy (the channels), Decorator (retries and logging) and Factory (the factory).
import type { Resident } from "./types.ts";

export interface Message {
  title: string;
  text: string;
}

export interface Channel {
  readonly name: string;
  send(resident: Resident, message: Message): void;
}

// A failure that may go away on a new attempt (provider down, rate limit)
export class TransientError extends Error {}

// A failure that repeats on every attempt (no such address, invalid number)
export class PermanentError extends Error {}

// Simulates the email, push and SMS providers. Some destinations fail on the
// first attempts, as real providers do, and others are invalid and always fail.
export class SimulatedProvider {
  readonly #failures: Map<string, number>;
  readonly #invalid: Set<string>;
  readonly delivered: string[] = [];

  constructor(failures: Record<string, number>, invalid: string[] = []) {
    this.#failures = new Map(Object.entries(failures));
    this.#invalid = new Set(invalid);
  }

  deliver(channel: string, destination: string, text: string): void {
    if (this.#invalid.has(destination)) throw new PermanentError("no such address");
    const remaining = this.#failures.get(destination) ?? 0;
    if (remaining > 0) {
      this.#failures.set(destination, remaining - 1);
      throw new TransientError("provider unavailable");
    }
    this.delivered.push(`${channel} ${destination} | ${text}`);
  }
}

// Each strategy knows the address and the format of its channel
export class Email implements Channel {
  readonly name = "email";
  readonly #provider: SimulatedProvider;

  constructor(provider: SimulatedProvider) {
    this.#provider = provider;
  }

  send(resident: Resident, m: Message): void {
    this.#provider.deliver(this.name, resident.email, `${m.title}: ${m.text}`);
  }
}

export class Push implements Channel {
  readonly name = "push";
  readonly #provider: SimulatedProvider;

  constructor(provider: SimulatedProvider) {
    this.#provider = provider;
  }

  // The app notification shows the title apart from the text
  send(resident: Resident, m: Message): void {
    this.#provider.deliver(this.name, resident.device!, `[${m.title}] ${m.text}`);
  }
}

export class Sms implements Channel {
  readonly name = "sms";
  readonly #provider: SimulatedProvider;

  constructor(provider: SimulatedProvider) {
    this.#provider = provider;
  }

  // SMS is short: only the title, and the details stay in the app
  send(resident: Resident, m: Message): void {
    this.#provider.deliver(this.name, resident.phone!, `Morada: ${m.title}`);
  }
}

// Decorator: logs each attempt without the channel knowing it is being watched
export class WithLogging implements Channel {
  readonly #channel: Channel;
  readonly #log: string[];

  constructor(channel: Channel, log: string[]) {
    this.#channel = channel;
    this.#log = log;
  }

  get name(): string {
    return this.#channel.name;
  }

  send(resident: Resident, message: Message): void {
    const who = `${this.name} to ${resident.name}`;
    try {
      this.#channel.send(resident, message);
      this.#log.push(`${who}: delivered (${message.title})`);
    } catch (error) {
      this.#log.push(`${who}: failed (${(error as Error).message})`);
      throw error;
    }
  }
}

// Who waits between attempts: in production, a timer; in the lab, a
// simulated clock that only records the wait, so the output is always the same
export type Wait = (ms: number, who: string) => void;

// Decorator: tries again before giving up, only when the failure is transient,
// and waits longer and longer between attempts (100 ms, 200 ms, 400 ms...)
export class WithRetries implements Channel {
  readonly #channel: Channel;
  readonly #attempts: number;
  readonly #wait: Wait;
  readonly #initialWaitMs: number;

  constructor(channel: Channel, attempts: number, wait: Wait, waitMs = 100) {
    this.#channel = channel;
    this.#attempts = attempts;
    this.#wait = wait;
    this.#initialWaitMs = waitMs;
  }

  get name(): string {
    return this.#channel.name;
  }

  send(resident: Resident, message: Message): void {
    for (let attempt = 1; ; attempt++) {
      try {
        return this.#channel.send(resident, message);
      } catch (error) {
        // Repeating a permanent failure only wastes time and provider quota
        if (!(error instanceof TransientError)) {
          const reason = (error as Error).message;
          throw new Error(`${this.name} failed without retry (${reason})`);
        }
        if (attempt === this.#attempts) {
          throw new Error(`${this.name} failed after ${attempt} attempts`);
        }
        const wait = this.#initialWaitMs * 2 ** (attempt - 1);
        this.#wait(wait, `${this.name} to ${resident.name}`);
      }
    }
  }
}

// Factory: picks the strategy from the resident's preference and wraps it in
// the decorators. Whoever sends notices knows no concrete class.
export class ChannelFactory {
  readonly #channels: Map<string, Channel>;
  readonly #log: string[];
  readonly #wait: Wait;

  constructor(provider: SimulatedProvider, log: string[], wait: Wait) {
    const channels = [new Email(provider), new Push(provider), new Sms(provider)];
    this.#channels = new Map(channels.map((c) => [c.name, c]));
    this.#log = log;
    this.#wait = wait;
  }

  forResident(resident: Resident): Channel {
    const channel =
      this.#channels.get(resident.channel) ?? this.#channels.get("email")!;
    // The order matters: retries outside, logging inside
    const withLogging = new WithLogging(channel, this.#log);
    return new WithRetries(withLogging, 3, this.#wait);
  }
}
