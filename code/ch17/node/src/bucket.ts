// Token bucket: it starts full, with "burst" tokens, and gains "perSecond" tokens per
// second, never above the maximum. Each request spends one token; with no token, the
// request is rejected. Tokens are counted in thousandths so the math stays exact with
// time in milliseconds.
export class TokenBucket {
  #burst: number;
  #perSecond: number;
  #thousandths: number;
  #last = 0;

  constructor(burst: number, perSecond: number) {
    this.#burst = burst;
    this.#perSecond = perSecond;
    this.#thousandths = burst * 1000;
  }

  allows(nowMs: number): boolean {
    const gain = (nowMs - this.#last) * this.#perSecond;
    this.#thousandths = Math.min(this.#burst * 1000, this.#thousandths + gain);
    this.#last = nowMs;
    if (this.#thousandths < 1000) return false;
    this.#thousandths -= 1000;
    return true;
  }
}
