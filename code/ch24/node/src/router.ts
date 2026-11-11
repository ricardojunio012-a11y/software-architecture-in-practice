// Routing for sharding by community. The communities fall into 12 logical shards; a map
// says which database (physical shard) each logical shard is on. Moving a logical shard
// to another database means copying the rows and changing one map entry, without
// recomputing the destination of any other community.
export const LOGICAL_SHARDS = 12;

export class Router {
  readonly #map: Map<number, string>;

  constructor(map: Record<number, string>) {
    this.#map = new Map(Object.entries(map).map(([l, p]) => [Number(l), p]));
  }

  // A simple hash, enough for the lab; in production, a hash that spreads well
  logicalShard(community: number) {
    return community % LOGICAL_SHARDS;
  }

  physical(community: number) {
    return this.#map.get(this.logicalShard(community))!;
  }

  all() {
    return [...new Set(this.#map.values())].sort();
  }

  move(logicalShard: number, target: string) {
    this.#map.set(logicalShard, target);
  }
}
