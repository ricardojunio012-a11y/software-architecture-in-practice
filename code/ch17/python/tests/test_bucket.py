# The token bucket: it lets the burst through, rejects the excess, and refills over time.
from morada.bucket import TokenBucket


def test_allows_the_burst_rejects_the_excess_and_gains_tokens_over_time():
    bucket = TokenBucket(10, 20)
    assert all(bucket.allows(0) for _ in range(10))
    assert not bucket.allows(0)
    # 20 tokens per second: one token every 50 ms
    assert not bucket.allows(49)
    assert bucket.allows(99)
