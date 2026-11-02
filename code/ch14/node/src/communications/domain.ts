// The Communications service from chapter 12, now with a notice repository: the
// same notice requested twice is sent only once.
export class InvalidDataError extends Error {}

export interface NoticeRepository {
  alreadySent(id: string): Promise<boolean>;
  record(id: string, text: string): Promise<void>;
}

export class Communications {
  readonly #notices: NoticeRepository;

  constructor(notices: NoticeRepository) {
    this.#notices = notices;
  }

  async send(id: string, text: string): Promise<"sent" | "duplicate"> {
    if (!text) throw new InvalidDataError("text is required");
    if (await this.#notices.alreadySent(id)) return "duplicate";
    await this.#notices.record(id, text);
    return "sent";
  }
}

export class InMemoryNotices implements NoticeRepository {
  readonly #notices = new Map<string, string>();

  async alreadySent(id: string) {
    return this.#notices.has(id);
  }

  async record(id: string, text: string) {
    this.#notices.set(id, text);
  }
}
