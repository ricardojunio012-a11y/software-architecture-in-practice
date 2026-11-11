<?php
// Token bucket: it starts full, with "burst" tokens, and gains "perSecond" tokens per
// second, never above the maximum. Each request spends one token; with no token, the
// request is rejected. Tokens are counted in thousandths so the math stays exact with
// time in milliseconds.
namespace Morada;

final class TokenBucket
{
    private int $thousandths;
    private int $last = 0;

    public function __construct(
        private readonly int $burst,
        private readonly int $perSecond,
    ) {
        $this->thousandths = $burst * 1000;
    }

    public function allows(int $nowMs): bool
    {
        $gain = ($nowMs - $this->last) * $this->perSecond;
        $this->thousandths = min($this->burst * 1000, $this->thousandths + $gain);
        $this->last = $nowMs;
        if ($this->thousandths < 1000) {
            return false;
        }
        $this->thousandths -= 1000;
        return true;
    }
}
