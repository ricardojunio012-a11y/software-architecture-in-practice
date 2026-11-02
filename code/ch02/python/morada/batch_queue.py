# Simulation of the batch invoice queue at the payment processor ("now the hard part").
# Simulated clock and a fixed-seed random draw: the same output on any machine.
# The numbers in batch.json are lab assumptions, not those of a real processor.
import math
from dataclasses import dataclass, field


@dataclass
class Result:
    files: int = 0
    attempts: int = 0
    available_at: dict[int, int] = field(default_factory=dict)  # second -> invoices
    not_created: int = 0  # never became available
    via_card: int = 0  # got card payment instead of the invoice


def generator(seed: int):
    """Park-Miller congruential generator: integers only, the same in all languages."""
    x = seed

    def draw() -> int:
        nonlocal x
        x = x * 48271 % 2147483647
        return x

    return draw


def simulate(p: dict, adjusted: bool) -> Result:
    """naive: resends every rejection and notifies the resident only with a created
    invoice. adjusted: a permanent rejection does not go back to the queue, and an
    invoice with no time left to be confirmed switches to card payment (the ADR-002
    alternative)."""
    draw = generator(p["seed"])
    queue = []  # (sent_at, order, invoices, attempt)
    for i in range(0, p["invoices"], p["invoicesPerFile"]):
        end = min(p["invoices"], i + p["invoicesPerFile"])
        queue.append((0, len(queue), list(range(i, end)), 1))
    r = Result()

    def available(t: int) -> None:
        r.available_at[t] = r.available_at.get(t, 0) + 1

    order = len(queue)
    processor_free = 0
    while queue:
        # The processor handles one file at a time, in order of arrival
        sent_at, _, invoices, attempt = queue.pop(queue.index(min(queue)))
        r.files += 1
        r.attempts += len(invoices)
        start = max(sent_at, processor_free)
        processor_free = start + math.ceil(len(invoices) / p["invoicesPerSecond"])
        return_at = processor_free + p["returnSeconds"]
        resend = []
        for inv in invoices:
            permanent = inv % p["permanentRejectionEvery"] == 0
            rejected = permanent or draw() % 100 < p["transientFailurePercent"]
            if not rejected:
                available(return_at)
            elif not adjusted:
                if attempt < p["maxAttempts"]:
                    resend.append(inv)
                else:
                    r.not_created += 1
            elif (
                permanent
                or attempt >= p["maxAttempts"]
                or return_at + p["returnSeconds"] > p["limitSeconds"]
            ):
                available(return_at)  # the notice goes out with card payment
                r.via_card += 1
            else:
                resend.append(inv)
        if resend:
            queue.append((return_at, order, resend, attempt + 1))
            order += 1
    return r


def percentile(r: Result, total: int, thousandths: int) -> int | None:
    """Nearest-rank percentile, in thousandths (990 = p99, 999 = p99.9).
    Returns None when it falls on the invoices that never became available."""
    rank = -(-thousandths * total // 1000)
    cumulative = 0
    for t in sorted(r.available_at):
        cumulative += r.available_at[t]
        if cumulative >= rank:
            return t
    return None


def available_by(r: Result, limit: int) -> int:
    return sum(n for t, n in r.available_at.items() if t <= limit)
