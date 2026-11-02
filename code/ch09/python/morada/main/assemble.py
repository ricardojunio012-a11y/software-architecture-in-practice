# Composition root: the only place that picks the adapters and wires them to the core.
import json
import os
from pathlib import Path

import psycopg

from morada.adapters.outbound.in_memory import InMemorySchedules
from morada.adapters.outbound.postgres import PostgresSchedules
from morada.application.booking_service import BookingService
from morada.domain.schedule import Space


def assemble(repository: str, prepare: bool = False):
    data = json.loads(Path("/data/input/spaces.json").read_text("utf-8"))
    spaces = [Space(s["id"], s["feeCents"], s["minNoticeDays"]) for s in data["spaces"]]
    if repository == "memory":
        schedules = InMemorySchedules(spaces)
        return BookingService(schedules), schedules
    db = psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)
    schedules = PostgresSchedules(db, spaces)
    if prepare:
        schedules.prepare()
    return BookingService(schedules), schedules
