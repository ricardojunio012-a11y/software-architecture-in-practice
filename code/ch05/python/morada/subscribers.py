# Who reacts to the booking events. Each does one thing and knows none of the others.
from morada.events import Event
from morada.notification import ChannelFactory, Message
from morada.types import dollars, us_date


class NotifyResident:
    name = "NotifyResident"

    def __init__(self, factory: ChannelFactory):
        self._factory = factory

    def handle(self, event: Event) -> None:
        r = event.request
        when = f"{r.space.name} on {us_date(r.date)}"
        if event.type == "BookingConfirmed":
            fee = dollars(r.space.fee_cents)
            message = Message("Booking confirmed", f"{when}. Usage fee: ${fee}.")
        else:
            message = Message("Booking rejected", f"{when}: {event.reason}.")
        resident = r.unit.resident
        self._factory.for_resident(resident).send(resident, message)


class ChargeUsageFee:
    name = "ChargeUsageFee"

    def __init__(self, fees: list[str]):
        self._fees = fees

    def handle(self, event: Event) -> None:
        r = event.request
        description = f"Usage fee: {r.space.name} on {us_date(r.date)}"
        self._fees.append(f"{r.unit.id};{description};{dollars(r.space.fee_cents)}")


class NotifyFrontDesk:
    name = "NotifyFrontDesk"

    def __init__(self, list: list[str]):
        self._list = list

    def handle(self, event: Event) -> None:
        r = event.request
        who = f"{r.unit.id} {r.unit.resident.name}"
        self._list.append(f"{us_date(r.date)} {r.space.name}: {who}")
