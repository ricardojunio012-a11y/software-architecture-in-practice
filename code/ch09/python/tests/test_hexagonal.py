# Tests: the core with no real adapter, the adapters with no real core, and the
# same contract checked against both repositories.
import os

import pytest

from morada.adapters.inbound.cli import execute
from morada.adapters.outbound.in_memory import InMemorySchedules
from morada.application.booking_service import BookingService
from morada.domain.schedule import NotFoundError, RuleViolatedError, Space

PARTY_ROOM = Space("party-room", 15000, 2)
REQUEST = {
    "booking": "R-1",
    "unit": "A-101",
    "space": "party-room",
    "date": "2026-03-14",
    "start": 14,
    "end": 22,
    "requestedOn": "2026-03-02",
}


def test_the_core_books_and_rejects_an_overlap_with_only_memory():
    service = BookingService(InMemorySchedules([PARTY_ROOM]))
    assert service.book(REQUEST)["fee"] == "$180.00"
    with pytest.raises(RuleViolatedError, match="overlaps R-1"):
        service.book({**REQUEST, "booking": "R-2"})


def test_the_command_line_adapter_does_not_need_the_real_core():
    calls = []

    class Fake:
        def cancel(self, booking, requested_on):
            calls.append(f"{booking} {requested_on}")
            return {"booking": booking, "cancellationFee": "$0.00"}

    result = execute(Fake(), ["cancel", "R-7", "2026-03-01"])
    assert calls == ["R-7 2026-03-01"]
    assert result == ("R-7 canceled, cancellation fee $0.00", 0)


def in_memory():
    return InMemorySchedules([PARTY_ROOM])


def in_postgres():
    import psycopg

    from morada.adapters.outbound.postgres import PostgresSchedules

    db = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
    schedules = PostgresSchedules(db, [PARTY_ROOM])
    schedules.prepare()
    return schedules


# In the container, the database exists; outside it, the PostgreSQL case is skipped
REPOSITORIES = [
    in_memory,
    pytest.param(
        in_postgres,
        marks=pytest.mark.skipif(
            not os.environ.get("DATABASE_URL"), reason="no database"
        ),
    ),
]


# The same contract holds for any adapter of the outbound port
@pytest.mark.parametrize("create", REPOSITORIES)
def test_contract_keeps_the_schedule_and_finds_it_by_booking(create):
    schedules = create()
    schedule = schedules.for_space("party-room")
    schedule.book("R-1", "A-101", "2026-03-14", 14, 22, "2026-03-02")
    schedules.save(schedule)
    assert [b.id for b in schedules.for_booking("R-1").bookings()] == ["R-1"]


@pytest.mark.parametrize("create", REPOSITORIES)
def test_contract_reports_when_the_booking_does_not_exist(create):
    with pytest.raises(NotFoundError):
        create().for_booking("R-9")
