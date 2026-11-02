# Tests: each layer can be tested without the ones above it; the core, without real
# plugins.
import pytest
from fastapi.testclient import TestClient

from morada.layers.application import BookingService
from morada.layers.data import ScheduleRepository
from morada.layers.domain import RuleViolationError, Schedule, Space
from morada.layers.presentation import create_api
from morada.plugins.core import Charge, Core

PARTY_ROOM = Space("party-room", 15000, 2)


def test_the_domain_rejects_an_overlapping_slot_without_knowing_http_exists():
    schedule = Schedule(PARTY_ROOM)
    schedule.book("R-1", "A-101", "2026-03-14", 14, 22, "2026-03-02")
    with pytest.raises(RuleViolationError):
        schedule.book("R-2", "A-202", "2026-03-14", 20, 23, "2026-03-02")


def test_the_presentation_layer_turns_the_violated_rule_into_409():
    api = TestClient(create_api(BookingService(ScheduleRepository([PARTY_ROOM]))))
    body = {
        "booking": "R-1",
        "unit": "A-101",
        "space": "party-room",
        "date": "2026-03-03",
        "start": 10,
        "end": 12,
        "requestedOn": "2026-03-02",
    }
    assert api.post("/bookings", json=body).status_code == 409


class FakePlugin:
    def __init__(self, name, register):
        self.name = name
        self.register = register


def test_issues_through_the_installed_plugin_and_reports_a_missing_plugin():
    core = Core()
    core.install(FakePlugin("test", lambda c: f"T-{c.unit}"))
    assert core.issue(Charge("A-1", 100, "test")) == "A-1;$1.00;test;T-A-1"
    assert (
        core.issue(Charge("A-1", 100, "zeta"))
        == "A-1;$1.00;zeta;no plugin for bank zeta"
    )


def test_a_faulty_plugin_does_not_bring_down_the_core():
    def broken(_c):
        raise RuntimeError("out of service")

    core = Core()
    core.install(FakePlugin("broken", broken))
    assert (
        core.issue(Charge("A-1", 100, "broken"))
        == "A-1;$1.00;broken;plugin broken failed: out of service"
    )


def test_rejects_a_plugin_that_does_not_fulfill_the_contract():
    with pytest.raises(TypeError, match="contract"):
        Core().install(object())
