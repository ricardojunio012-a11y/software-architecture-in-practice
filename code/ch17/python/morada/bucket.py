# Token bucket: it starts full, with "burst" tokens, and gains "per_second" tokens per
# second, never above the maximum. Each request spends one token; with no token, the
# request is rejected. Tokens are counted in thousandths so the math stays exact with
# time in milliseconds.
class TokenBucket:
    def __init__(self, burst: int, per_second: int):
        self.burst = burst
        self.per_second = per_second
        self.thousandths = burst * 1000
        self.last = 0

    def allows(self, now_ms: int) -> bool:
        gain = (now_ms - self.last) * self.per_second
        self.thousandths = min(self.burst * 1000, self.thousandths + gain)
        self.last = now_ms
        if self.thousandths < 1000:
            return False
        self.thousandths -= 1000
        return True
