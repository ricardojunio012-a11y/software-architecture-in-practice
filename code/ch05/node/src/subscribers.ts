// Who reacts to the booking events. Each does one thing and knows none of the others.
import type { Event, Subscriber } from "./events.ts";
import type { ChannelFactory, Message } from "./notification.ts";
import { dollars, usDate } from "./types.ts";

export class NotifyResident implements Subscriber {
  readonly name = "NotifyResident";
  readonly #factory: ChannelFactory;

  constructor(factory: ChannelFactory) {
    this.#factory = factory;
  }

  handle({ type, request, reason }: Event): void {
    const when = `${request.space.name} on ${usDate(request.date)}`;
    const message: Message =
      type === "BookingConfirmed"
        ? {
            title: "Booking confirmed",
            text: `${when}. Usage fee: $${dollars(request.space.feeCents)}.`,
          }
        : { title: "Booking rejected", text: `${when}: ${reason}.` };
    const resident = request.unit.resident;
    this.#factory.forResident(resident).send(resident, message);
  }
}

export class ChargeUsageFee implements Subscriber {
  readonly name = "ChargeUsageFee";
  readonly #fees: string[];

  constructor(fees: string[]) {
    this.#fees = fees;
  }

  handle({ request }: Event): void {
    const { unit, space, date } = request;
    const description = `Usage fee: ${space.name} on ${usDate(date)}`;
    this.#fees.push(`${unit.id};${description};${dollars(space.feeCents)}`);
  }
}

export class NotifyFrontDesk implements Subscriber {
  readonly name = "NotifyFrontDesk";
  readonly #list: string[];

  constructor(list: string[]) {
    this.#list = list;
  }

  handle({ request }: Event): void {
    const { unit, space, date } = request;
    this.#list.push(`${usDate(date)} ${space.name}: ${unit.id} ${unit.resident.name}`);
  }
}
