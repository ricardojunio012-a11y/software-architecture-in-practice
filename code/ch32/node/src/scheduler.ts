// The Kubernetes scheduler in two stages, as the documentation describes it:
// filter the nodes where the pod's CPU request fits and score the ones left.
// The default scoring (LeastAllocated) prefers the node with the most room, which
// spreads the replicas. On a tie, Kubernetes picks at random; here the name wins,
// so the output is always the same.
export type Node = {
  name: string;
  cpu: number; // thousandths of a core allocatable to the application
  requested: number; // sum of the requests of the pods already placed on it
  ready: boolean;
};

export function pickNode(nodes: Node[], request: number): Node | undefined {
  const fit = nodes.filter((n) => n.ready && n.cpu - n.requested >= request);
  const room = (n: Node) => (n.cpu - n.requested) / n.cpu;
  fit.sort((a, b) => room(b) - room(a) || a.name.localeCompare(b.name));
  return fit[0]; // undefined: the pod stays Pending
}
