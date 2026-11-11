// The ports: what Morada needs from the cloud, said in Morada's language.
// None of them talks about buckets, SQS queues, or DynamoDB tables.

// Outbound port: store and read files, such as the financial report PDF
export interface Files {
  store(path: string, content: Uint8Array, type: string): Promise<void>;
  read(path: string): Promise<Uint8Array | undefined>;
}

// Outbound port: tasks to do later. Delivery is "at least once": the receiver
// acks after doing the work; without an ack, the task comes back
export interface Tasks {
  publish(task: Task): Promise<void>;
  receive(max: number): Promise<ReceivedTask[]>;
  ack(received: ReceivedTask): Promise<void>;
}

export interface Task {
  type: "notify-residents";
  community: string;
  month: string;
}

export interface ReceivedTask {
  task: Task;
  receipt: string;
}

// Outbound port: the index of the documents published per community
export interface Documents {
  // Writes only if it does not exist yet; returns false if it already existed
  registerIfNew(document: Document): Promise<boolean>;
  // Returns what was just written: the read must be consistent
  forCommunity(community: string): Promise<Document[]>;
}

export interface Document {
  community: string;
  month: string;
  path: string;
  bytes: number;
}

// What the core receives: the three ports, without knowing who implements them
export interface Cloud {
  files: Files;
  tasks: Tasks;
  documents: Documents;
}
