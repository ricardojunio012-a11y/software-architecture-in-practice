# Tests of the batch queue simulation: same seed, same result.
from morada.batch_queue import available_by, percentile, simulate

ASSUMPTIONS = {
    "id": "T",
    "description": "test",
    "invoices": 1000,
    "invoicesPerFile": 250,
    "invoicesPerSecond": 10,
    "returnSeconds": 100,
    "transientFailurePercent": 20,
    "permanentRejectionEvery": 50,
    "maxAttempts": 3,
    "limitSeconds": 400,
    "seed": 7,
}


def test_naive_tail_goes_past_the_limit_and_some_are_never_created():
    r = simulate(ASSUMPTIONS, False)
    assert (r.files, r.attempts, r.not_created) == (12, 1246, 26)
    assert available_by(r, 400) == 968
    assert percentile(r, 1000, 500) == 175
    assert percentile(r, 1000, 990) is None  # p99 falls on the never created


def test_adjusted_all_available_within_the_limit_part_by_card():
    r = simulate(ASSUMPTIONS, True)
    assert (r.files, r.attempts, r.via_card) == (11, 1199, 32)
    assert available_by(r, 400) == 1000
    assert percentile(r, 1000, 990) == 357


def test_same_seed_same_result():
    assert simulate(ASSUMPTIONS, False) == simulate(ASSUMPTIONS, False)
