// Instagram-style 64-bit identifiers: 41 bits of time in milliseconds since a custom
// epoch, 13 bits of logical shard, and 10 bits of sequence. Each shard generates its
// own IDs without talking to anyone, the IDs follow creation order, and the ID itself
// tells which shard the row lives in.
const EPOCH_MS = BigInt(Date.UTC(2026, 0, 1));

export function makeId(nowMs: number, logicalShard: number, sequence: number): bigint {
  return (
    ((BigInt(nowMs) - EPOCH_MS) << 23n) |
    (BigInt(logicalShard) << 10n) |
    // The sequence wraps around at 1,024: more than 1,024 IDs in the same millisecond
    // on the same shard repeat the first ones. To avoid that, wait for the next ms
    BigInt(sequence % 1024)
  );
}

export function readId(id: bigint) {
  return {
    createdAt: new Date(Number((id >> 23n) + EPOCH_MS)).toISOString(),
    logicalShard: Number((id >> 10n) & 0x1fffn),
    sequence: Number(id & 0x3ffn),
  };
}
