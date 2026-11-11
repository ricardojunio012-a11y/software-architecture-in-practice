// Load-balancing algorithms: given the state of the servers, which one gets the next
// request. The servers are simulated; what matters is the decision.

export interface Server {
  inFlight: number; // requests being served right now
}

export type Algorithm = (
  servers: Server[],
  key: number,
  random: () => number,
) => number;

let next = 0;
export const roundRobin: Algorithm = (servers) => next++ % servers.length;

export const leastConnections: Algorithm = (servers) =>
  servers.reduce((best, s, i) => (s.inFlight < servers[best].inFlight ? i : best), 0);

// The power of two choices: pick two servers at random and keep the less busy one
export const twoChoices: Algorithm = (servers, _key, random) => {
  const a = Math.floor(random() * servers.length);
  const b = Math.floor(random() * servers.length);
  return servers[a].inFlight <= servers[b].inFlight ? a : b;
};

// Hash of the key (the community): the same community always on the same server
export const keyHash: Algorithm = (servers, key) => key % servers.length;

// Seeded pseudorandom generator, so the simulation always gives the same result
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
