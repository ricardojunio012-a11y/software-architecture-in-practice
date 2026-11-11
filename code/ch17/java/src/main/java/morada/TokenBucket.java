// Token bucket: it starts full, with "burst" tokens, and gains "perSecond" tokens per
// second, never above the maximum. Each request spends one token; with no token, the
// request is rejected. Tokens are counted in thousandths so the math stays exact with
// time in milliseconds.
package morada;

public class TokenBucket {

    private final long burst;
    private final long perSecond;
    private long thousandths;
    private long last = 0;

    public TokenBucket(long burst, long perSecond) {
        this.burst = burst;
        this.perSecond = perSecond;
        this.thousandths = burst * 1000;
    }

    public boolean allows(long nowMs) {
        long gain = (nowMs - last) * perSecond;
        thousandths = Math.min(burst * 1000, thousandths + gain);
        last = nowMs;
        if (thousandths < 1000) return false;
        thousandths -= 1000;
        return true;
    }
}
