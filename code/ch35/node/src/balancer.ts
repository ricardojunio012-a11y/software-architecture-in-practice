// A client-side load balancer: it rotates among the replicas and, if asked,
// tries the next one when a replica does not answer.
export interface Replica {
  name: string;
  zone: string;
}

export type Transport = (replica: Replica) => Promise<boolean>;

export class Balancer {
  private next = 0;
  private replicas: Replica[];
  private transport: Transport;
  private tryAnother: boolean;

  constructor(replicas: Replica[], transport: Transport, tryAnother: boolean) {
    this.replicas = replicas;
    this.transport = transport;
    this.tryAnother = tryAnother;
  }

  async request(): Promise<boolean> {
    const n = this.replicas.length;
    const start = this.next;
    this.next = (this.next + 1) % n;
    const attempts = this.tryAnother ? n : 1;
    for (let i = 0; i < attempts; i++) {
      if (await this.transport(this.replicas[(start + i) % n])) return true;
    }
    return false;
  }
}
